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
    // deterministically fails `400 INVALID_SIGNATURE "Unknown signer"`. Two
    // distinct gateway/SDK defects, both confirmed by recovering the signer
    // from the exact EIP-712 order the terminal signs:
    //   1. The SDK's `useSubmitConditionalOrder` body OMITS the signed
    //      `triggerAbove` field, so the gateway re-hashes the order with its
    //      default (false) while the terminal signed `true` → wrong signer.
    //      (MARKET/LIMIT sign triggerAbove=false, matching the default, so they
    //      pass — which is why only conditional orders break.)
    //   2. The gateway round-trips large numeric fields through a JS number when
    //      re-hashing, so a trigger ≥ 1e24 ($1,000,000 in 18-dec) also flips the
    //      signer (5^24 > 2^53 → not double-exact). Hence the double-exact
    //      $1,048,576 (= 2^20) below, so this passes once (1) is fixed.
    // The terminal signs correctly; the hermetic Tier 1 conditional specs
    // (06/09/14) cover the UI flow. Remove this fixme when the SDK includes
    // triggerAbove in the conditional submit body.
    test.fixme(
      true,
      "SDK conditional submit omits the signed triggerAbove → gateway INVALID_SIGNATURE",
    );
    await ensureTradeReady(page);
    const trade = new TradePanel(page);
    const userInfo = new UserInfoPanel(page);

    await trade.selectTab("stop");
    await trade.setSize("0.001");
    await trade.setTriggerPrice("1048576");
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
