import {
  DepositDialog,
  MarketHeaderPanel,
  WithdrawDialog,
} from "../pages/TerminalPanels";
import { ensureTradeReady } from "./ensureTradeReady";
import { liveConfigured, liveEnv } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: deposit & withdraw", () => {
  // Two real on-chain txs (deposit + withdraw) — budget like the fill test.
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs * 2 + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  // Small round-trip: the withdraw returns the deposit, so reruns don't bleed
  // the pool wallet. Needs ≥$5 of fUSDC in the wallet (faucet `claim` refills).
  const AMOUNT = "5";

  test("deposits then withdraws the same amount round-trip", async ({
    page,
  }) => {
    await ensureTradeReady(page);
    const market = new MarketHeaderPanel(page);
    const margin = async () =>
      Number((await market.margin.textContent())!.replace(/[$,]/g, ""));

    const start = await margin();

    await market.openDeposit();
    const deposit = new DepositDialog(page);
    await deposit.deposit(AMOUNT);
    await expect(deposit.root).toBeHidden({ timeout: liveEnv.fillTimeoutMs });
    // Tolerant threshold (refresh timing / dust): the deposit must land.
    await expect
      .poll(margin, { timeout: liveEnv.fillTimeoutMs })
      .toBeGreaterThanOrEqual(start + 4.5);

    const funded = await margin();
    await market.openWithdraw();
    const withdraw = new WithdrawDialog(page);
    await withdraw.withdraw(AMOUNT);
    await expect(withdraw.root).toBeHidden({ timeout: liveEnv.fillTimeoutMs });
    await expect
      .poll(margin, { timeout: liveEnv.fillTimeoutMs })
      .toBeLessThanOrEqual(funded - 4.5);
  });
});
