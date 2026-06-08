import { WAD } from "../support/constants";
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
    // resting limit shows its side, type, size (1) and limit price ($60,000)
    await expect(userInfo.orderRow("ord-limit-1")).toContainText("BUY");
    await expect(userInfo.orderRow("ord-limit-1")).toContainText("LIMIT");
    await expect(userInfo.orderRow("ord-limit-1")).toContainText("60,000");
    // conditional shows its side, type and trigger price ($80,000)
    await expect(userInfo.orderRow("ord-cond-1")).toBeVisible();
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("SELL");
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("STOP_MARKET");
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("80,000");
  });

  test("renders a resting order whose price the gateway sent in scientific notation", async ({
    page,
    world,
  }) => {
    // Regression for the live crash: the gateway serializes a WAD price ≥ 1e21
    // ($1000+) through a JS number, so it arrives as "1e+21". BigInt("1e+21")
    // throws, which used to blank the open-orders table (no error boundary).
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [limitOrderFixture({ id: "ord-sci", limitPrice: "1e+21" })],
        conditionalOrders: [
          conditionalOrderFixture({ id: "ord-sci-trig", triggerPrice: "1e+24" }),
        ],
      }),
    );

    await userInfo.selectTab("open-orders");
    // Both rows render (no crash) with their prices expanded for display.
    await expect(userInfo.orderRow("ord-sci")).toBeVisible();
    await expect(userInfo.orderRow("ord-sci")).toContainText("1,000");
    await expect(userInfo.orderRow("ord-sci-trig")).toBeVisible();
    await expect(userInfo.orderRow("ord-sci-trig")).toContainText("1,000,000");
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

  test("cancelling one order leaves the others in place", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [
          limitOrderFixture({ id: "ord-A" }),
          limitOrderFixture({
            id: "ord-B",
            limitPrice: (65_000n * WAD).toString(),
          }),
        ],
      }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-A")).toBeVisible();
    await expect(userInfo.orderRow("ord-B")).toBeVisible();

    await userInfo.cancelOrder("ord-A");

    await expect(userInfo.orderRow("ord-A")).toBeHidden();
    await expect(userInfo.orderRow("ord-B")).toBeVisible(); // the sibling survives
    expect(world.cancelledOrderIds).toEqual(["ord-A"]);
  });
});
