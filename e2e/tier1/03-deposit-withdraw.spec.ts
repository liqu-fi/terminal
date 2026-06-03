import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("deposit & withdraw", () => {
  test("depositing credits margin by the entered amount and enables trading", async ({
    page,
    world,
  }) => {
    const { market, trade, deposit } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].available = 0n;
      w.accounts[0].withdrawable = 0n;
      return w;
    });

    await expect(market.margin).toHaveText(/\$0\.00/);
    await expect(trade.insufficientMargin).toBeVisible();

    await market.openDeposit();
    await expect(deposit.root).toBeVisible();
    await deposit.deposit("200");

    await expect(deposit.root).toBeHidden();
    // margin reflects the deposited amount (not a fixed mock value)
    await expect(market.margin).toHaveText(/\$200\.00/);
    await expect(trade.insufficientMargin).toBeHidden();
    // the app sent a positive (deposit) collateral delta on-chain
    expect(world.lastCollateralDelta).toBeGreaterThan(0n);
  });

  test("withdrawing debits margin by the entered amount", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world); // starts at $5,000

    await expect(market.margin).toHaveText(/\$5,000\.00/);
    await market.openWithdraw();
    await expect(withdraw.root).toBeVisible();
    await withdraw.withdraw("100");

    await expect(withdraw.root).toBeHidden();
    await expect(market.margin).toHaveText(/\$4,900\.00/);
    // the app sent a negative (withdraw) collateral delta on-chain
    expect(world.lastCollateralDelta).toBeLessThan(0n);
  });
});
