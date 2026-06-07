import { WAD } from "../support/constants";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import {
  limitOrderFixture,
  readyWorld,
  sseCandleFrame,
  sseOrderUpdateFrame,
} from "../support/world";

test.describe("live SSE updates", () => {
  test("an order_update over SSE refetches and clears the filled order", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    // Queue an SSE fill. The mock removes the order from the open set ONLY when
    // this frame is actually delivered over SSE — so the background poll keeps
    // returning the order until then, and the order clearing proves the SSE
    // path drove it (not polling). Causality, not timing, is the assertion.
    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "MATCHED")];

    await expect(userInfo.ordersEmpty).toBeVisible({ timeout: 15_000 });
  });

  test("a non-terminal order_update (PARTIALLY_FILLED) keeps the order open", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    // A partial-fill frame IS delivered (it leaves the queue) but, being a
    // non-terminal status, must NOT remove the order from the open set — the
    // mirror of the MATCHED case above.
    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "PARTIALLY_FILLED")];
    await expect.poll(() => world.sseFrames.length).toBe(0); // frame consumed
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible(); // still resting
  });

  test("an SSE fill clears only the matched order, not its siblings", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [
          limitOrderFixture({ id: "ord-a" }),
          limitOrderFixture({
            id: "ord-b",
            limitPrice: (65_000n * WAD).toString(),
          }),
        ],
      }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-a")).toBeVisible();
    await expect(userInfo.orderRow("ord-b")).toBeVisible();

    // A terminal fill for ord-a must clear only ord-a — channel selectivity.
    world.sseFrames = [sseOrderUpdateFrame("ord-a", "MATCHED")];
    await expect(userInfo.orderRow("ord-a")).toBeHidden({ timeout: 15_000 });
    await expect(userInfo.orderRow("ord-b")).toBeVisible(); // sibling untouched
  });

  test("an SSE fill refetches the account margin", async ({ page, world }) => {
    const { market } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );
    await expect(market.margin).toHaveText(/\$5,000\.00/);

    // The fill consumes margin on-chain; the order_update SSE frame invalidates
    // the account query (not just orders), so the displayed margin refetches.
    world.accounts[0].available = 4_000n * WAD;
    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "MATCHED")];
    await expect(market.margin).toHaveText(/\$4,000\.00/, { timeout: 15_000 });
  });

  test("the chart subscribes to 1m candles and redraws on a streamed bar", async ({
    page,
    world,
  }) => {
    const { app } = await enterTerminal(page, world);
    // The chart's channel is part of some SSE connection's channel set.
    await expect
      .poll(() =>
        world.sseConnections.some((c) => c.includes("candles:200:1m")),
      )
      .toBe(true);

    // Pixel-hash every canvas: a new bar far from the flat 70k history forces
    // an autoscale + redraw, so the hash MUST change when the bar lands.
    const canvasHash = () =>
      page.evaluate(() => {
        let h = 5381;
        for (const c of Array.from(document.querySelectorAll("canvas"))) {
          const s = (c as HTMLCanvasElement).toDataURL();
          for (let i = 0; i < s.length; i++)
            h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        }
        return h;
      });
    await expect(page.locator("canvas").first()).toBeVisible({
      timeout: 15_000,
    });
    const before = await canvasHash();

    const lastTs = world.candles.at(-1)!.timestamp;
    const p80k = (80_000n * WAD).toString();
    world.sseFrames = [
      sseCandleFrame("200", {
        bucketStartTs: lastTs + 60,
        open: p80k,
        high: p80k,
        low: p80k,
        close: p80k,
        volume: WAD.toString(),
        tradeCount: 1,
        lastTradePrice: p80k,
      }),
    ];
    await expect.poll(() => world.sseFrames.length).toBe(0); // delivered
    await expect.poll(canvasHash, { timeout: 15_000 }).not.toBe(before);
    await expect(app.terminal).toBeVisible(); // still healthy
  });
});
