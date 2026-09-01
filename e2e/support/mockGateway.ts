/**
 * Mock order-gateway. Intercepts every request to the gateway origin and serves
 * REST + SSE from the MockWorld.
 *
 * Responses are returned as BARE objects/arrays (no `{data:...}` envelope): the
 * SDK's response parser returns `json.data ?? json`, so a bare shape is correct
 * whether or not a given endpoint wraps — and it can't accidentally double-wrap.
 */
import type { Page, Route } from "@playwright/test";

import { TEST_ADDRESS } from "./constants";
import type {
  GatewayOrder,
  MockWorld,
  SessionKeyGrantPayload,
  SessionKeyRecord,
} from "./world";

function send(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function error(route: Route, status: number, code = "internal"): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ error: { code, message: code } }),
  });
}

function marketSummary(world: MockWorld) {
  return world.markets.map((m) => ({
    id: m.id,
    symbol: m.symbol,
    pythFeedId: m.pythFeedId,
    minSize: m.minSize,
    maxLeverage: m.maxLeverage,
  }));
}

// `MarketsService.listFull` maps `BigInt(initialMarginBps)` /
// `BigInt(maintenanceMarginBps)`, so those fields must be present integer
// strings (a bare summary made `BigInt(undefined)` throw). 50 bps maintenance
// drives the terminal's liq-price estimate.
function marketFull(world: MockWorld) {
  return world.markets.map((m) => ({
    id: m.id,
    symbol: m.symbol,
    pythFeedId: m.pythFeedId,
    isActive: true,
    initialMarginBps: "200",
    maintenanceMarginBps: "50",
    dynamic: null,
  }));
}

function orderListFor(world: MockWorld, status: string | null): GatewayOrder[] {
  if (status && status.includes("TRIGGER_PENDING"))
    return world.conditionalOrders;
  return world.openOrders;
}

/**
 * Mirror a real gateway: a resting LIMIT order lands in open orders; a trigger
 * order (STOP_* / TAKE_PROFIT_*) lands in conditional orders. MARKET orders
 * settle and don't rest.
 */
function restSubmittedOrder(
  world: MockWorld,
  id: string,
  payload: Record<string, unknown>,
): void {
  const orderType = String(payload.orderType ?? "MARKET");
  if (orderType === "MARKET") return;
  const order: GatewayOrder = {
    id,
    accountId: String(payload.accountId ?? "1"),
    marketId: String(payload.marketId ?? world.markets[0]?.id ?? "200"),
    sizeDelta: String(payload.sizeDelta ?? "0"),
    side: (payload.side as "BUY" | "SELL") ?? "BUY",
    orderType: orderType as GatewayOrder["orderType"],
    status: orderType === "LIMIT" ? "PENDING" : "TRIGGER_PENDING",
    limitPrice: payload.limitPrice != null ? String(payload.limitPrice) : null,
    triggerPrice:
      payload.triggerPrice != null ? String(payload.triggerPrice) : null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  if (orderType === "LIMIT") world.openOrders.push(order);
  else world.conditionalOrders.push(order);
}

/**
 * Сколько мок держит SSE-соединение открытым, ожидая кадр.
 *
 * @remarks Дедлайн — обрыв без последствий: пустой ответ по нему НЕ заставляет
 * клиента переподключиться (`pump` в `SseService` просто выходит из цикла по
 * `done`, а переподключение происходит только при смене набора каналов). Значит
 * спека, простоявшая до присваивания `world.sseFrames` дольше этого срока,
 * кадр не получит вовсе и упадёт по таймауту без внятной причины. Нынешние
 * укладываются с запасом (их собственные таймауты — 15 с); длинную сцену надо
 * либо резать, либо поднимать это число вместе с ней.
 */
const SSE_LONGPOLL_MS = 20_000;
const OPEN_STATUSES = new Set([
  "PENDING",
  "PARTIALLY_FILLED",
  "TRIGGER_PENDING",
]);

/**
 * Long-poll the SSE stream: hold the connection open until a frame is queued
 * (or we time out), then return a snapshot of the queued frames. The caller
 * clears + applies them ONLY after a successful fulfill, so a frame can't be
 * lost to a stale/aborted connection (the app reconnects when its channel set
 * changes after orders load; that abandoned request must not consume the frame
 * meant for the live one).
 *
 * @remarks `generation` is this request's 1-based rank in `world.sseConnections`
 * at the moment it registered. The client aborts its old connection *before*
 * opening the new one, but the old connection's route handler keeps running —
 * `route.fulfill()` on an aborted request does not reliably throw (observed
 * empirically: it can resolve and clear `world.sseFrames` for a browser-side
 * request nobody is listening to any more). Comparing the live
 * `world.sseConnections.length` against the snapshotted `generation` catches
 * this: once a *newer* connection has registered, this one stops racing for
 * frames and returns empty, leaving them for the connection that's actually
 * still attached to the page.
 */
async function sseLongPoll(
  world: MockWorld,
  generation: number,
): Promise<string[]> {
  const deadline = Date.now() + SSE_LONGPOLL_MS;
  while (
    Date.now() < deadline &&
    world.sseFrames.length === 0 &&
    world.sseConnections.length === generation
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (world.sseConnections.length !== generation) return [];
  return [...world.sseFrames];
}

function parseSseOrderUpdate(
  raw: string,
): { orderId: string; status: string } | null {
  const match = raw.match(/data:\s*(\{.*\})/s);
  if (!match) return null;
  try {
    const evt = JSON.parse(match[1]) as {
      type?: string;
      data?: { orderId?: string; status?: string };
    };
    if (evt.type === "order_update" && evt.data?.orderId) {
      return {
        orderId: String(evt.data.orderId),
        status: String(evt.data.status ?? ""),
      };
    }
  } catch {
    /* not a JSON order_update frame */
  }
  return null;
}

/**
 * A delivered order_update with a terminal status removes that order from the
 * open/conditional sets — exactly what the real gateway reflects on the next
 * fetch. Crucially this happens ONLY on delivery, so a subsequent /orders
 * refetch (whether triggered by the SSE invalidation or the background poll)
 * observes the change only because the frame was actually delivered.
 */
function applySseEffects(world: MockWorld, frames: string[]): void {
  for (const raw of frames) {
    const update = parseSseOrderUpdate(raw);
    if (!update || OPEN_STATUSES.has(update.status)) continue;
    world.openOrders = world.openOrders.filter((o) => o.id !== update.orderId);
    world.conditionalOrders = world.conditionalOrders.filter(
      (o) => o.id !== update.orderId,
    );
  }
}

export async function mockGateway(page: Page, world: MockWorld): Promise<void> {
  await page.route(/gateway\.e2e\.local/, async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    // --- SSE ---------------------------------------------------------------
    if (path.endsWith("/sse")) {
      world.sseConnections.push(
        (url.searchParams.get("channels") ?? "").split(","),
      );
      const generation = world.sseConnections.length;
      const frames = await sseLongPoll(world, generation);
      try {
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
          body: frames.join(""),
        });
        // Apply + clear ONLY after a delivery that landed on a live connection.
        if (frames.length > 0) {
          applySseEffects(world, frames);
          world.sseFrames = [];
        }
      } catch {
        // Stale/aborted connection (or page closed): leave the frame queued so
        // the live connection still receives it.
      }
      return;
    }

    // --- auth --------------------------------------------------------------
    if (path.endsWith("/auth/nonce")) {
      world.authNonceRequests += 1;
      await send(route, { nonce: `e2e-nonce-${world.authNonceRequests}` });
      return;
    }
    if (path.endsWith("/auth/verify")) {
      if (world.faults.authVerifyStatus) {
        world.authVerifyRejections += 1;
        await error(route, world.faults.authVerifyStatus, "unauthorized");
        return;
      }
      const payload = JSON.parse(req.postData() ?? "{}") as {
        message: string;
        signature: string;
      };
      world.authVerifyRequests.push(payload);
      await send(route, { token: "e2e-token", address: TEST_ADDRESS });
      return;
    }

    // --- accounts ----------------------------------------------------------
    const register = path.match(/\/accounts\/([^/]+)\/register$/);
    if (register) {
      world.registeredAccountIds.push(register[1]);
      await send(route, { accountId: register[1], mode: "BOOK" });
      return;
    }
    const modeCheck = path.match(/\/accounts\/([^/]+)\/mode-check$/);
    if (modeCheck) {
      const acct = world.accounts.find((a) => a.id.toString() === modeCheck[1]);
      await send(route, { mode: acct?.orderMode ?? "ONCHAIN" });
      return;
    }

    // --- session keys (1-click trading) ------------------------------------
    // "/session-keys/nonce" must precede the "/session-keys/:id" DELETE matcher,
    // which would otherwise capture it as id="nonce".
    if (path.endsWith("/session-keys/nonce")) {
      world.sessionKeyNonceRequests += 1;
      await send(route, { nextNonce: world.sessionKeyNonce.toString() });
      return;
    }
    if (path.endsWith("/session-keys")) {
      if (method === "POST") {
        if (world.faults.sessionKeyRegisterStatus) {
          await error(route, world.faults.sessionKeyRegisterStatus);
          return;
        }
        const payload = JSON.parse(req.postData() ?? "{}") as {
          grant: SessionKeyGrantPayload;
          signature: string;
        };
        const record: SessionKeyRecord = {
          id: `sess-${world.sessionKeys.length + 1}`,
          grant: payload.grant,
          signature: payload.signature,
          // Echo the client's validUntil: the real gateway is authoritative
          // here, and the SDK prefers this value over its own.
          expiresAt: Number(payload.grant.validUntil),
        };
        world.sessionKeys.push(record);
        world.sessionKeyNonce += 1n;
        await send(route, { id: record.id, expiresAt: record.expiresAt });
        return;
      }
      await send(route, world.sessionKeys);
      return;
    }
    const sessionKey = path.match(/\/session-keys\/([^/]+)$/);
    if (sessionKey && method === "DELETE") {
      world.revokedSessionKeyIds.push(sessionKey[1]);
      world.sessionKeys = world.sessionKeys.filter(
        (s) => s.id !== sessionKey[1],
      );
      await send(route, { ok: true });
      return;
    }

    // --- orderbook -----------------------------------------------------------
    // Must precede the generic "/markets" endsWith check below: a more
    // specific path segment ("/orderbook") has to be matched first, or the
    // broader match would swallow it.
    const book = path.match(/\/markets\/([^/]+)\/orderbook$/);
    if (book) {
      if (world.faults.orderbookStatus) {
        // Код зависит от статуса, а не пришит к маршруту: 503 гейтвей отдаёт
        // с `ORDERBOOK_UNAVAILABLE` («книгу никто не ведёт» — состояние
        // рынка), любой другой отказ — обычная поломка. С пришитым кодом SDK
        // считал `unavailable` и на 500, то есть ветка `book-error` была
        // недостижима из тестов вовсе.
        await error(
          route,
          world.faults.orderbookStatus,
          world.faults.orderbookStatus === 503
            ? "ORDERBOOK_UNAVAILABLE"
            : "internal",
        );
        return;
      }
      await send(route, world.orderbook);
      return;
    }

    // --- markets -----------------------------------------------------------
    if (path.endsWith("/markets/full")) {
      await send(route, marketFull(world));
      return;
    }
    if (path.endsWith("/markets")) {
      if (world.faults.marketsStatus) {
        await error(route, world.faults.marketsStatus);
        return;
      }
      await send(route, marketSummary(world));
      return;
    }
    const price = path.match(/\/markets\/([^/]+)\/price$/);
    if (price) {
      if (world.faults.priceStatus) {
        await error(route, world.faults.priceStatus);
        return;
      }
      await send(route, {
        price: world.price.toString(),
        timestamp: 1_717_200_000_000,
      });
      return;
    }
    const funding = path.match(/\/markets\/([^/]+)\/funding$/);
    if (funding) {
      if (world.faults.fundingStatus) {
        await error(route, world.faults.fundingStatus);
        return;
      }
      await send(route, world.funding);
      return;
    }
    const candles = path.match(/\/markets\/([^/]+)\/candles$/);
    if (candles) {
      if (world.faults.candlesStatus) {
        await error(route, world.faults.candlesStatus);
        return;
      }
      await send(route, world.candlesByMarket?.[candles[1]] ?? world.candles);
      return;
    }

    // --- order nonce (must precede the order matchers: "/orders/nonce" would
    // otherwise be captured by the single-order regex as orderId="nonce") ----
    // Static — the mock never advances orderNonce on submits, unlike the real
    // gateway. A test fetching the nonce twice gets the same seed; fine for
    // current specs (the SDK's syncNonce is monotonic-max, a stale seed no-ops).
    if (path.endsWith("/orders/nonce")) {
      world.orderNonceRequests += 1;
      await send(route, { nextNonce: world.orderNonce.toString() });
      return;
    }

    // --- orders ------------------------------------------------------------
    if (path.endsWith("/orders")) {
      if (method === "POST") {
        const payload = JSON.parse(req.postData() ?? "{}") as Record<
          string,
          unknown
        >;
        world.submittedOrders.push(payload);
        // One-shot INVALID_NONCE conflict: reject THIS submit naming the nonce
        // the gateway expects (the real error envelope shape). Cleared on use,
        // so the SDK's automatic retry then succeeds.
        if (world.faults.submitNonceConflictExpected) {
          const expected = world.faults.submitNonceConflictExpected;
          delete world.faults.submitNonceConflictExpected;
          await route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "INVALID_NONCE",
                message: "invalid nonce",
                details: { expected },
              },
            }),
          });
          return;
        }
        if (world.faults.submitOrderStatus) {
          await error(route, world.faults.submitOrderStatus, "order_rejected");
          return;
        }
        const id = `srv-${world.submittedOrders.length}`;
        restSubmittedOrder(world, id, payload);
        await send(route, { orderId: id, status: "PENDING" });
        return;
      }
      if (method === "DELETE") {
        await send(route, { results: [] });
        return;
      }
      // GET list
      const status = url.searchParams.get("status");
      if (world.faults.ordersStatus) {
        await error(route, world.faults.ordersStatus);
        return;
      }
      await send(route, orderListFor(world, status));
      return;
    }
    const singleOrder = path.match(/\/orders\/([^/]+)$/);
    if (singleOrder) {
      const id = singleOrder[1];
      if (method === "DELETE") {
        if (world.faults.cancelStatus) {
          await error(route, world.faults.cancelStatus, "cancel_failed");
          return;
        }
        world.cancelledOrderIds.push(id);
        world.openOrders = world.openOrders.filter((o) => o.id !== id);
        world.conditionalOrders = world.conditionalOrders.filter(
          (o) => o.id !== id,
        );
        await send(route, { orderId: id, status: "CANCELLED" });
        return;
      }
      const found =
        world.openOrders.find((o) => o.id === id) ??
        world.conditionalOrders.find((o) => o.id === id);
      await send(route, found ?? null);
      return;
    }

    // --- trades ------------------------------------------------------------
    if (path.endsWith("/trades")) {
      // Барьер для сцены загрузки ленты: спека держит ответ и проверяет
      // `tape-loading`, потом отпускает и проверяет `tape-empty`.
      await world.holds.tradesRead?.promise;
      if (world.faults.tradesStatus) {
        await error(route, world.faults.tradesStatus);
        return;
      }
      await send(route, { rows: world.trades, nextCursor: null });
      return;
    }

    // Unknown gateway route — fail loud so a missing mock surfaces in tests.
    await error(route, 404, "no_mock");
  });
}
