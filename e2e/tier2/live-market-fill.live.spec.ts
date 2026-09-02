import { TradePanel, UserInfoPanel } from "../pages/TerminalPanels";
import { ensureTradeReady } from "./ensureTradeReady";
import { liveConfigured, liveEnv } from "./env";
import { expect, test } from "./liveFixtures";

/**
 * Highest-fidelity live check: a real MARKET order that actually fills against
 * the Synthetix pool — opening an on-chain position — then a reduce via an
 * equal, opposing MARKET order that flattens it. Exercises the full
 * offchain-match → onchain-settle round-trip that the resting-limit test
 * (priced never to fill) deliberately skips.
 *
 * The positions table is read-only (no close button) and the UI doesn't expose
 * reduceOnly, so a position is closed the way the protocol nets size: an exact
 * opposing MARKET order drives net size to zero, after which the gateway drops
 * the size-0 position and the row clears.
 */
test.describe("live: market fill lifecycle", () => {
  // Two on-chain settlements (open + close) — budget generously.
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs * 2 + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  const SIZE = "0.001"; // tiny notional, fills instantly against the pool

  test("market order fills, opens a position, then flattens it", async ({
    page,
  }) => {
    await ensureTradeReady(page);

    const trade = new TradePanel(page);
    const userInfo = new UserInfoPanel(page);
    const positionRow = page.locator('[data-testid^="position-row-"]');

    // Require a flat start — the test cleans up after itself, so reruns begin
    // empty; a leftover position would invalidate the close assertion below.
    await userInfo.selectTab("positions");
    await expect(userInfo.positionsEmpty).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });

    // ── Open: MARKET long ───────────────────────────────────────────────
    await trade.selectTab("market");
    await trade.setSize(SIZE);
    await expect(trade.submitButton).toBeEnabled({
      timeout: liveEnv.fillTimeoutMs,
    });
    await trade.submit();

    // The fill settles on-chain; the enriched long position then appears.
    await userInfo.selectTab("positions");
    await expect(positionRow.first()).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
    await expect(positionRow.first()).toContainText("↑"); // long marker

    // ── Close: equal, opposing MARKET short ─────────────────────────────
    await trade.selectTab("market");
    await trade.setSize(SIZE);
    await expect(trade.submitButton).toBeEnabled({
      timeout: liveEnv.fillTimeoutMs,
    });
    await trade.submit("sell");

    // Net size → 0: the gateway drops the size-0 position, clearing the row.
    await userInfo.selectTab("positions");
    await expect(userInfo.positionsEmpty).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
  });
});
