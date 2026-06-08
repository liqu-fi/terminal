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
    // BLOCKED UPSTREAM (monorepo, not the terminal). The conditional submit
    // deterministically fails `400 INVALID_SIGNATURE "Unknown signer"`: the
    // SDK's `useSubmitConditionalOrder` POST body OMITS the signed
    // `triggerAbove` field, so the gateway re-hashes the order with its default
    // (`dto.triggerAbove ?? false` in submit-order.handler.ts) while the
    // terminal signed `true` → recovers a different address. MARKET/LIMIT sign
    // `triggerAbove=false` (= the default), which is why only conditional
    // orders break. Confirmed by recovering the signer from the exact EIP-712
    // `Order` the terminal signs (filed against monorepo with a repro).
    //
    // The terminal signs correctly; Tier 1 06/09/14 cover the conditional UI
    // flow. Remove this fixme once the SDK sends `triggerAbove` in the body.
    test.fixme(
      true,
      "SDK conditional submit omits the signed triggerAbove → gateway INVALID_SIGNATURE",
    );
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
