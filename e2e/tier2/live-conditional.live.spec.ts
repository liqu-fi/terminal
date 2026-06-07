import { TradePanel, UserInfoPanel } from "../pages/TerminalPanels";
import { ensureTradeReady } from "./ensureTradeReady";
import { liveConfigured, liveEnv } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: conditional orders", () => {
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("places and cancels a stop-market trigger order", async ({ page }) => {
    await ensureTradeReady(page);
    const trade = new TradePanel(page);
    const userInfo = new UserInfoPanel(page);

    await trade.selectTab("stop");
    await trade.setSize("0.001");
    // Trigger far above any realistic BTC mark (triggerAbove defaults to true),
    // so conditional-svc never fires it — the order rests until we cancel it.
    await trade.setTriggerPrice("1000000");
    await expect(trade.submitButton).toBeEnabled({
      timeout: liveEnv.fillTimeoutMs,
    });
    await trade.submit();

    await userInfo.selectTab("open-orders");
    const rows = page.locator('[data-testid^="order-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: liveEnv.fillTimeoutMs });
    const before = await rows.count();

    await page.locator('[data-testid^="cancel-order-"]').first().click();
    await expect(rows).toHaveCount(before - 1, {
      timeout: liveEnv.fillTimeoutMs,
    });
  });
});
