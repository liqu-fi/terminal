import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("trade form gating & controls", () => {
  test("submit is disabled until a size is entered", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);
    await expect(trade.submitButton).toBeDisabled();
    await trade.setSize("0.5");
    await expect(trade.submitButton).toBeEnabled();
  });

  test("zero or non-numeric size keeps submit disabled", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.setSize("0");
    await expect(trade.submitButton).toBeDisabled();
    await trade.setSize("abc");
    await expect(trade.submitButton).toBeDisabled();
    await trade.setSize("0.5");
    await expect(trade.submitButton).toBeEnabled();
  });

  test("no available margin disables submit and shows the hint", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].available = 0n;
      return w;
    });
    await trade.setSize("0.5");
    await expect(trade.insufficientMargin).toBeVisible();
    await expect(trade.submitButton).toBeDisabled();
  });

  test("submit stays disabled while there is no mark price", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world, () => {
      const w = readyWorld(); // funded BOOK account → margin is fine
      w.price = 0n; // gateway has no mark price yet → markPrice resolves to 0n
      return w;
    });

    await trade.setSize("0.5");
    // it's the missing price gating submit, not the margin…
    await expect(trade.insufficientMargin).toBeHidden();
    await expect(trade.submitButton).toBeDisabled();
  });

  test("tabs reveal the right fields", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);

    await expect(trade.limitPriceInput).toBeHidden();
    await expect(trade.triggerPriceInput).toBeHidden();

    await trade.selectTab("limit");
    await expect(trade.limitPriceInput).toBeVisible();

    await trade.selectTab("stop");
    await expect(trade.limitPriceInput).toBeHidden();
    await expect(trade.triggerPriceInput).toBeVisible();

    await trade.selectTab("take-profit");
    await expect(trade.triggerPriceInput).toBeVisible();

    await trade.selectTab("market");
    await expect(trade.limitPriceInput).toBeHidden();
    await expect(trade.triggerPriceInput).toBeHidden();
  });

  test("side toggle and leverage slider update state", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await expect(trade.sideLong).toHaveAttribute("aria-pressed", "true");
    await trade.sideShort.click();
    await expect(trade.sideShort).toHaveAttribute("aria-pressed", "true");
    await expect(trade.sideLong).toHaveAttribute("aria-pressed", "false");

    await trade.setLeverage(5);
    await expect(trade.leverageValue).toHaveText("5×");
    // size = availableUsd * leverage / markPrice = 5,000 * 5 / 70,000 ≈ 0.3571
    await expect(trade.sizeInput).toHaveValue(/^0\.3571/);
  });
});
