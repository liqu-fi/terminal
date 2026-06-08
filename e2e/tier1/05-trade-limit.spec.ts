import { Price } from "@liq/sdk";

import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("limit orders", () => {
  test("a limit order sends acceptablePrice equal to the limit price", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("limit");
    await trade.setSize("1");
    await trade.setLimitPrice("65000");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    const order = world.submittedOrders.at(-1)!;
    expect(order.limitPrice).toBe(Price.parse("65000").toString());
    expect(order.acceptablePrice).toBe(Price.parse("65000").toString());
  });

  test("a limit submit with a blank price is enabled but sends nothing", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("limit");
    await trade.setSize("1"); // valid size, price left blank

    await expect(trade.submitButton).toBeEnabled();
    await trade.submit();

    await expect(trade.tradeError).toBeHidden();
    expect(world.submittedOrders.length).toBe(0);
  });

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
    // the typed $65,000 limit reaches the gateway in 18-dec WAD (via the SDK's
    // own parser, so the expected value tracks the app's encoding)
    expect(world.submittedOrders.at(-1)?.limitPrice).toBe(
      Price.parse("65000").toString(),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.ordersTable).toBeVisible();
    await expect(userInfo.orderRow("srv-1")).toBeVisible();
    await expect(userInfo.orderRow("srv-1")).toContainText("LIMIT");
  });
});
