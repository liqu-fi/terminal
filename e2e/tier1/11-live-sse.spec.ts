import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import {
  limitOrderFixture,
  readyWorld,
  sseOrderUpdateFrame,
} from "../support/world";

test.describe("live SSE updates", () => {
  test("an order_update over SSE refetches and clears the filled order", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    // Queue an SSE fill. The mock removes the order from the open set ONLY when
    // this frame is actually delivered over SSE — so the background poll keeps
    // returning the order until then, and the order clearing proves the SSE
    // path drove it (not polling). Causality, not timing, is the assertion.
    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "MATCHED")];

    await expect(userInfo.ordersEmpty).toBeVisible({ timeout: 15_000 });
  });
});
