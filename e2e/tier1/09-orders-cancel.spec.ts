import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import {
  conditionalOrderFixture,
  limitOrderFixture,
  readyWorld,
} from "../support/world";

test.describe("open orders", () => {
  test("lists resting + conditional orders", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [limitOrderFixture()],
        conditionalOrders: [conditionalOrderFixture()],
      }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();
    // resting limit shows its limit price ($60,000)
    await expect(userInfo.orderRow("ord-limit-1")).toContainText("60,000");
    // conditional shows its trigger price ($80,000) + type
    await expect(userInfo.orderRow("ord-cond-1")).toBeVisible();
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("80,000");
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("STOP_MARKET");
  });

  test("cancels a resting order", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();
    await userInfo.cancelOrder("ord-limit-1");

    await expect(userInfo.ordersEmpty).toBeVisible();
    expect(world.cancelledOrderIds).toContain("ord-limit-1");
  });
});
