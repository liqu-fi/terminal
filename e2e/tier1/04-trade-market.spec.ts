import { Qty } from "@liq/sdk";

import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { WAD } from "../support/constants";

test.describe("market orders", () => {
  test("submits a market BUY and resets the form", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.selectTab("market");
    await trade.setSize("0.5");
    await expect(trade.submitButton).toBeEnabled();
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    const order = world.submittedOrders.at(-1)!;
    expect(order.orderType).toBe("MARKET");
    expect(order.side).toBe("BUY");
    // BUY 0.5 ⇒ +0.5 in 18-dec WAD (pins the sign AND the magnitude/scaling,
    // computed via the SDK's own parser so it can't drift from the app's)
    expect(order.sizeDelta).toBe(Qty.parse("0.5").toString());
    await expect(trade.sizeInput).toHaveValue("");
  });

  test("submits a market SELL (short)", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.sideShort.click();
    await expect(trade.sideShort).toHaveAttribute("aria-pressed", "true");
    await trade.setSize("0.5");
    await trade.submit();

    await expect
      .poll(() => world.submittedOrders.at(-1)?.side)
      .toBe("SELL");
    // SELL ⇒ negative signed sizeDelta
    expect(String(world.submittedOrders.at(-1)?.sizeDelta).startsWith("-")).toBe(
      true,
    );
  });

  test("a market order carries the slippage-guarded acceptablePrice", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.setSize("0.5"); // BUY (default side)
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    expect(world.submittedOrders.at(-1)?.acceptablePrice).toBe(
      ((70_000n * WAD * 10_050n) / 10_000n).toString(), // mark + 0.5%
    );

    await trade.sideShort.click();
    await trade.setSize("0.5");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(1);
    expect(world.submittedOrders.at(-1)?.acceptablePrice).toBe(
      ((70_000n * WAD * 9_950n) / 10_000n).toString(), // mark − 0.5%
    );
  });

  test("seeds the order nonce from the gateway and recovers from INVALID_NONCE (#443)", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    // The client store boots with a timestamp-derived nonce (~1.8e15); the
    // gateway seed is higher, so after the sync lands the FIRST submit must
    // carry exactly the server value — proving the seed, not the local guess.
    // (Soft barrier: this clears when the GET hits the mock, a few microtasks
    // before the .then applies syncNonce — but the fill+click round-trips
    // below dwarf that gap, and a miss fails loudly on the nonce assertion.)
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(0);

    await trade.setSize("0.5");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(String(world.submittedOrders[0].nonce)).toBe("8888888888888888888");
    await expect(trade.sizeInput).toHaveValue(""); // confirmed submit resets

    // Now the gateway rejects the next nonce and names the one it expects:
    // the SDK must resync to it and retry the SAME order — with no surfaced
    // error and no user interaction.
    // ~1.1e17 above the seed — a server-side jump the client can't predict.
    world.faults.submitNonceConflictExpected = "9000000000000000000";
    await trade.setSize("0.25");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBe(3); // reject + retry
    expect(String(world.submittedOrders[1].nonce)).toBe("8888888888888888889");
    expect(String(world.submittedOrders[2].nonce)).toBe("9000000000000000000");
    await expect(trade.tradeError).toBeHidden(); // recovery, not failure
    await expect(trade.sizeInput).toHaveValue("");
  });
});
