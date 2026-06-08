import { Margin } from "@liq/sdk";

import { enterTerminal } from "../pages/flows";
import { WAD } from "../support/constants";
import { expect, test } from "../support/fixtures";
import { armHold, readyWorld, releaseHold } from "../support/world";

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

  // NOTE: liqcx/monorepo#434 — the SDK's deposit mutation does not surface a
  // reverted modifyCollateral as `deposit.error` (unlike withdraw). The in-repo
  // mitigation (an explicit onError) prevents the unhandled rejection; the full
  // error-UI fix needs an SDK change. This test pins the stable outcome.
  test("a reverted deposit leaves margin unchanged and sends no collateral delta", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].available = 0n;
      w.accounts[0].withdrawable = 0n;
      return w;
    });
    world.faults.collateralReverts = true;

    await market.openDeposit();
    await expect(deposit.root).toBeVisible();
    await deposit.deposit("200");

    // Deterministic outcome: no margin moved, no collateral delta recorded.
    await expect(market.margin).toHaveText(/\$0\.00/);
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

  test("withdraw submit is gated on a non-empty amount", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world);
    await market.openWithdraw();

    await expect(withdraw.submitButton).toBeDisabled(); // empty
    await withdraw.amountInput.fill("50");
    await expect(withdraw.submitButton).toBeEnabled();
    await withdraw.amountInput.fill("");
    await expect(withdraw.submitButton).toBeDisabled(); // cleared again
    expect(world.lastCollateralDelta).toBe(0n); // nothing was ever sent
  });

  test("cancelling the withdraw dialog closes it without sending a tx", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world);
    await market.openWithdraw();
    await expect(withdraw.root).toBeVisible();
    await withdraw.amountInput.fill("100"); // even with an amount entered…

    await withdraw.cancelButton.click();
    await expect(withdraw.root).toBeHidden(); // …cancel just dismisses
    expect(world.lastCollateralDelta).toBe(0n); // no collateral tx was sent
  });

  test("a malformed withdraw amount surfaces an error and sends no tx", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world); // $5,000
    await market.openWithdraw();
    await withdraw.amountInput.fill("abc"); // non-numeric → submit is enabled (non-empty)

    await expect(withdraw.submitButton).toBeEnabled();
    await withdraw.submitButton.click();

    // The error renders (not an uncaught throw), nothing is sent, margin holds.
    await expect(withdraw.error).toBeVisible();
    await expect(market.margin).toHaveText(/\$5,000\.00/);
    expect(world.lastCollateralDelta).toBe(0n);
  });

  test("clicking the dialog backdrop closes it; clicking inside does not", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world);
    await market.openDeposit();
    await expect(deposit.root).toBeVisible();

    // Click inside the panel — dialog stays open (stopPropagation).
    await deposit.root.getByText("Deposit USDC").click();
    await expect(deposit.root).toBeVisible();

    // Click the backdrop (top-left corner, outside the panel) — dialog closes.
    await deposit.overlay.click({ position: { x: 5, y: 5 } });
    await expect(deposit.root).toBeHidden();
    expect(world.lastCollateralDelta).toBe(0n);
  });

  test("the deposit button shows a pending state while the tx is in flight", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].available = 0n;
      w.accounts[0].withdrawable = 0n;
      return w;
    });
    armHold(world, "collateralReceipt"); // hold the receipt → mutation stays pending

    await market.openDeposit();
    await deposit.deposit("200");

    await expect(deposit.submitButton).toHaveText(/Depositing…/);
    await expect(deposit.submitButton).toBeDisabled();

    releaseHold(world, "collateralReceipt");
    await expect(deposit.root).toBeHidden(); // settles + closes on success
    await expect(market.margin).toHaveText(/\$200\.00/);
  });

  test("the withdraw button shows a pending state while the tx is in flight", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world); // $5,000
    armHold(world, "collateralReceipt");

    await market.openWithdraw();
    await withdraw.withdraw("100");

    await expect(withdraw.submitButton).toHaveText(/Withdrawing…/);
    await expect(withdraw.submitButton).toBeDisabled();

    releaseHold(world, "collateralReceipt");
    await expect(withdraw.root).toBeHidden();
    await expect(market.margin).toHaveText(/\$4,900\.00/);
  });

  test("an account with debt offers an atomic Repay & Withdraw", async ({
    page,
    world,
  }) => {
    // Synthetix blocks withdrawals while the account carries debt; the dialog
    // surfaces it and switches the action to an atomic repay+withdraw (#453 arc).
    const { market, withdraw } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].debt = 12n * WAD; // $12 closed-at-loss debt
      return w;
    });

    await market.openWithdraw();
    await expect(withdraw.root).toBeVisible();
    await expect(withdraw.debtNotice).toBeVisible();
    await expect(withdraw.debtNotice).toContainText("12");
    await withdraw.amountInput.fill("100");
    await expect(withdraw.submitButton).toHaveText("Repay & Withdraw");
  });
});
