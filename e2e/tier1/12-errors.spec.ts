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
    // the attempt actually reached the gateway, and the failed submit preserves
    // the user's input (the form only clears on success)
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    await expect(trade.sizeInput).toHaveValue("0.5");
  });

  test("a failed order submit can be retried once the fault clears", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    world.faults.submitOrderStatus = 500;

    await trade.setSize("0.5");
    await trade.submit();
    await expect(trade.tradeError).toBeVisible();

    // the input survived the error, so clearing the fault + resubmitting works
    delete world.faults.submitOrderStatus;
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(1);
    await expect(trade.sizeInput).toHaveValue(""); // success clears the form
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
    // a causal anchor: markets genuinely failed to load ⇒ the selector has zero
    // options (the "—" price alone also matches the brief initial-load state).
    await expect(
      page.getByTestId("market-select").locator("option"),
    ).toHaveCount(0);
  });
});
