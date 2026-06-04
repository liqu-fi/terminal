import { Margin } from "@liq/sdk";

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
    // the app sent exactly the typed amount as a positive collateral delta
    expect(world.lastCollateralDelta).toBe(Margin.parse("200"));
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
    // the app sent exactly the typed amount as a negative collateral delta
    expect(world.lastCollateralDelta).toBe(-Margin.parse("100"));
  });

  // NOTE: the deposit revert path is intentionally not asserted here. Unlike
  // withdraw (below), a reverted deposit surfaces as an *unhandled* promise
  // rejection from the SDK's DepositService.modifyCollateral and never sets the
  // mutation error, so no `deposit-error` is rendered. Tracked in liqcx/monorepo#434
  // — a test that asserted `deposit-error` would pin broken behavior.
  test("a reverted withdraw surfaces an error and leaves margin unchanged", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world); // $5,000
    world.faults.collateralReverts = true;

    await market.openWithdraw();
    await expect(withdraw.root).toBeVisible();
    await withdraw.withdraw("100");

    await expect(withdraw.error).toBeVisible();
    await expect(market.margin).toHaveText(/\$5,000\.00/); // unchanged
    expect(world.lastCollateralDelta).toBe(0n);
  });

  test("deposit submit is gated on a non-empty amount", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world);
    await market.openDeposit();

    await expect(deposit.submitButton).toBeDisabled(); // empty
    await deposit.amountInput.fill("50");
    await expect(deposit.submitButton).toBeEnabled();
    await deposit.amountInput.fill("");
    await expect(deposit.submitButton).toBeDisabled(); // cleared again
    expect(world.lastCollateralDelta).toBe(0n); // nothing was ever sent
  });

  test("cancelling the deposit dialog closes it without sending a tx", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world);
    await market.openDeposit();
    await expect(deposit.root).toBeVisible();
    await deposit.amountInput.fill("100"); // even with an amount entered…

    await deposit.cancelButton.click();
    await expect(deposit.root).toBeHidden(); // …cancel just dismisses
    expect(world.lastCollateralDelta).toBe(0n); // no collateral tx was sent
  });
});
