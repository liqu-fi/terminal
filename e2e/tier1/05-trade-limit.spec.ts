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

  test("a limit submit is disabled until a price is entered", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("limit");
    await trade.setSize("1"); // valid size, price left blank

    // A limit order with no price can't be sent — the submit is gated, not a
    // no-op click (clearer than the old "enabled but does nothing").
    await expect(trade.submitButton).toBeDisabled();
    expect(world.submittedOrders.length).toBe(0);

    await trade.setLimitPrice("65000");
    await expect(trade.submitButton).toBeEnabled();
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
