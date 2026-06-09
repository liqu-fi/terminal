import { Price } from "@liq/sdk";

import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("conditional orders", () => {
  test("a conditional order omits acceptablePrice and carries triggerAbove", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("stop");
    await trade.setSize("1");
    await trade.setTriggerPrice("80000");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    const order = world.submittedOrders.at(-1)!;
    expect(order.acceptablePrice).toBeUndefined();
    expect(order.triggerAbove).toBeDefined();
  });

  test("a stop submit is disabled until a trigger is entered", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("stop");
    await trade.setSize("1"); // trigger left blank

    // No trigger price → nothing to submit; the button is gated rather than an
    // enabled no-op.
    await expect(trade.submitButton).toBeDisabled();
    expect(world.submittedOrders.length).toBe(0);

    await trade.setTriggerPrice("80000");
    await expect(trade.submitButton).toBeEnabled();
  });

  test("the trigger direction defaults to ≥, toggles, and is submitted", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("stop");

    await expect(trade.triggerAbove).toHaveAttribute("aria-pressed", "true");
    await expect(trade.triggerBelow).toHaveAttribute("aria-pressed", "false");

    await trade.triggerBelow.click();
    await expect(trade.triggerAbove).toHaveAttribute("aria-pressed", "false");
    await expect(trade.triggerBelow).toHaveAttribute("aria-pressed", "true");

    await trade.setSize("1");
    await trade.setTriggerPrice("60000");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    expect(world.submittedOrders.at(-1)?.triggerAbove).toBe(false);
  });

  test("submits a stop-market trigger order", async ({ page, world }) => {
    const { trade, userInfo } = await enterTerminal(page, world);

    await trade.selectTab("stop");
    await expect(trade.triggerPriceInput).toBeVisible();
    await trade.setSize("0.5");
    await trade.setTriggerPrice("80000");
    await trade.triggerAbove.click();
    await trade.submit();

    await expect
      .poll(() => world.submittedOrders.at(-1)?.orderType)
      .toBe("STOP_MARKET");
    const stop = world.submittedOrders.at(-1)!;
    // the typed $80,000 trigger reaches the gateway in 18-dec WAD, long side
    expect(stop.triggerPrice).toBe(Price.parse("80000").toString());
    expect(stop.side).toBe("BUY");

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("srv-1")).toBeVisible();
  });

  test("submits a take-profit trigger order", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.selectTab("take-profit");
    await trade.setSize("0.5");
    await trade.setTriggerPrice("90000");
    await trade.triggerBelow.click();
    await trade.submit();

    await expect
      .poll(() => world.submittedOrders.at(-1)?.orderType)
      .toBe("TAKE_PROFIT_MARKET");
    expect(world.submittedOrders.at(-1)?.triggerPrice).toBe(
      Price.parse("90000").toString(),
    );
  });
});
