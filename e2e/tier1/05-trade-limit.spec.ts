import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("limit orders", () => {
  test("submits a limit order that appears in open orders", async ({
    page,
    world,
  }) => {
    const { trade, userInfo } = await enterTerminal(page, world);

    await trade.selectTab("limit");
    await expect(trade.limitPriceInput).toBeVisible();
    await trade.setSize("0.5");
    await trade.setLimitPrice("65000");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.at(-1)?.orderType).toBe(
      "LIMIT",
    );
    expect(world.submittedOrders.at(-1)?.limitPrice).toBeTruthy();

    await userInfo.selectTab("open-orders");
    await expect(userInfo.ordersTable).toBeVisible();
    await expect(userInfo.orderRow("srv-1")).toBeVisible();
    await expect(userInfo.orderRow("srv-1")).toContainText("LIMIT");
  });
});
