import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("conditional orders", () => {
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
    expect(world.submittedOrders.at(-1)?.triggerPrice).toBeTruthy();

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
  });
});
