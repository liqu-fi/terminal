import { WAD } from "../support/constants";
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

  test("a non-terminal order_update (PARTIALLY_FILLED) keeps the order open", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    // A partial-fill frame IS delivered (it leaves the queue) but, being a
    // non-terminal status, must NOT remove the order from the open set — the
    // mirror of the MATCHED case above.
    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "PARTIALLY_FILLED")];
    await expect.poll(() => world.sseFrames.length).toBe(0); // frame consumed
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible(); // still resting
  });

  test("an SSE fill clears only the matched order, not its siblings", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [
          limitOrderFixture({ id: "ord-a" }),
          limitOrderFixture({
            id: "ord-b",
            limitPrice: (65_000n * WAD).toString(),
          }),
        ],
      }),
    );

    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-a")).toBeVisible();
    await expect(userInfo.orderRow("ord-b")).toBeVisible();

    // A terminal fill for ord-a must clear only ord-a — channel selectivity.
    world.sseFrames = [sseOrderUpdateFrame("ord-a", "MATCHED")];
    await expect(userInfo.orderRow("ord-a")).toBeHidden({ timeout: 15_000 });
    await expect(userInfo.orderRow("ord-b")).toBeVisible(); // sibling untouched
  });
});
