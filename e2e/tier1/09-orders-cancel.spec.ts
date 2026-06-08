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

  test("order rows show their status, abs size, and an em-dash for no price", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [limitOrderFixture()],
        conditionalOrders: [
          conditionalOrderFixture(), // SELL, sizeDelta = -WAD, triggerPrice 80k
          conditionalOrderFixture({ id: "ord-noprice", triggerPrice: null }),
        ],
      }),
    );
    await userInfo.selectTab("open-orders");

    // P2b: Status cell.
    await expect(userInfo.orderRow("ord-limit-1")).toContainText("PENDING");
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("TRIGGER_PENDING");

    // P2c: conditional Size renders abs(-1) = 1.
    await expect(userInfo.orderRow("ord-cond-1").locator("td").nth(3)).toHaveText("1");

    // P2d: a null-price conditional renders an em-dash in the Price cell.
    await expect(userInfo.orderRow("ord-noprice").locator("td").nth(4)).toHaveText("—");
  });

  test("cancelling a conditional order removes its row", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ conditionalOrders: [conditionalOrderFixture()] }),
    );
    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-cond-1")).toBeVisible();

    await userInfo.cancelOrder("ord-cond-1");

    await expect(userInfo.ordersEmpty).toBeVisible();
    expect(world.cancelledOrderIds).toContain("ord-cond-1");
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
