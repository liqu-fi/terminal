import { AppPage } from "../pages/AppPage";
import { enterTerminal } from "../pages/flows";
import { expect, seed, test } from "../support/fixtures";
import { limitOrderFixture, readyWorld } from "../support/world";

test.describe("error states", () => {
  test("a gateway 500 on order submit surfaces a trade error", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    world.faults.submitOrderStatus = 500;

    await trade.setSize("0.5");
    await trade.submit();

    await expect(trade.tradeError).toBeVisible();
  });

  test("a failed cancel leaves the order in place", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );
    world.faults.cancelStatus = 500;

    await userInfo.selectTab("open-orders");
    await userInfo.cancelOrder("ord-limit-1");

    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();
    expect(world.cancelledOrderIds).not.toContain("ord-limit-1");
  });

  test("the terminal still renders when markets fail to load", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.marketsStatus = 500;

    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    await expect(app.terminal).toBeVisible();
    await expect(page.getByTestId("market-price")).toContainText("—");
  });
});
