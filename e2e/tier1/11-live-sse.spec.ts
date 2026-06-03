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

    // The order fills: the next /orders refetch returns empty, and a queued SSE
    // order_update frame triggers that refetch. The mock SSE long-polls, so the
    // frame is delivered to the held-open connection near-instantly.
    world.openOrders = [];
    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "MATCHED")];

    // Must clear well before the open-orders query's 10s background poll could
    // do it — proving SSE drove the refetch, not polling.
    await expect(userInfo.ordersEmpty).toBeVisible({ timeout: 7_000 });
  });
});
