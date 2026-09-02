import { MarketHeaderPanel, TradePanel, UserInfoPanel } from "../pages/TerminalPanels";
import { ensureTradeReady } from "./ensureTradeReady";
import { liveConfigured, liveEnv } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: trade lifecycle", () => {
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("market data renders from the live gateway", async ({ page }) => {
    await ensureTradeReady(page);
    const market = new MarketHeaderPanel(page);
    await expect(market.price).not.toHaveText("—");
    await expect(market.margin).not.toHaveText("—");
  });

  test("places and cancels a resting limit order", async ({ page }) => {
    await ensureTradeReady(page);
    const trade = new TradePanel(page);
    const userInfo = new UserInfoPanel(page);

    await trade.selectTab("limit");
    await trade.setSize("0.001");
    await trade.setLimitPrice("1000"); // far below market → rests, won't fill
    await expect(trade.submitButton).toBeEnabled({ timeout: liveEnv.fillTimeoutMs });
    await trade.submit();

    await userInfo.selectTab("open-orders");
    const rows = page.locator('[data-testid^="orders-table-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: liveEnv.fillTimeoutMs });
    const before = await rows.count();

    await page.locator('[data-testid^="cancel-order-"]').first().click();
    await expect(rows).toHaveCount(before - 1, { timeout: liveEnv.fillTimeoutMs });
  });
});
