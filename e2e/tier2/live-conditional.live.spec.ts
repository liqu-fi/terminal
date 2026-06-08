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
    // Re-enabled after the SDK conditional-submit fix shipped. Previously the
    // gateway rejected this with `400 INVALID_SIGNATURE "Unknown signer"`: the
    // SDK's `useSubmitConditionalOrder` POST body omitted the signed
    // `triggerAbove`, so the gateway re-hashed the order with its default
    // (`dto.triggerAbove ?? false`) while the terminal signed `true`. Fixed in
    // @liqcx/liq-react@0.27.2 (liqcx/monorepo#449): the submit body now carries
    // `triggerAbove`, so the gateway reconstructs the exact signed order.
    // Gated by `liveConfigured()` above — runs only against a live env.
    await ensureTradeReady(page);
    const trade = new TradePanel(page);
    const userInfo = new UserInfoPanel(page);

    await trade.selectTab("stop");
    await trade.setSize("0.001");
    // Far above any realistic mark (triggerAbove defaults to true) so it never
    // fires and rests until we cancel it.
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
