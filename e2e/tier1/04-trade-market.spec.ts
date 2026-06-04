import { Qty } from "@liq/sdk";

import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

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
});
