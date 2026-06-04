import { enterTerminal } from "../pages/flows";
import { WAD } from "../support/constants";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("market data", () => {
  test("header renders market, price, funding and margin", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world);

    await expect(market.marketSelect).toHaveValue("200");
    await expect(market.marketSelect).toContainText("BTC");
    await expect(market.price).toHaveText(/\$70,000/);
    await expect(market.funding).toHaveText(/0\.1000%/);
    await expect(market.margin).toHaveText(/\$5,000\.00/);
  });

  test("candle chart renders a canvas from backfilled history", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    await expect(page.locator("canvas").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("price gains a direction arrow + color when it moves", async ({
    page,
    world,
  }) => {
    // Two real ~5s price-refetch waits (up then down) on top of boot — give it
    // headroom over the 30s default so cold-start contention can't time it out.
    test.setTimeout(45_000);
    const { market } = await enterTerminal(page, world); // price seeds at $70,000

    // First poll has no prior price to compare against → neutral, no arrow.
    await expect(market.price).toHaveText(/\$70,000/);
    await expect(market.price).not.toContainText("▲");

    // A tick up flips the next poll (refetchInterval) to up-arrow + long color.
    world.price = 71_000n * WAD;
    await expect(market.price).toContainText("▲", { timeout: 15_000 });
    await expect(market.price).toHaveClass(/text-long/);

    // …and back down to a down-arrow + short color.
    world.price = 69_000n * WAD;
    await expect(market.price).toContainText("▼", { timeout: 15_000 });
    await expect(market.price).toHaveClass(/text-short/);
  });

  test("an empty candle history leaves the chart and terminal usable", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.candles = []; // gateway returns no history
      return w;
    });
    // the chart still mounts (the canvas is created regardless of data) and the
    // rest of the terminal stays functional — the no-data path must not crash.
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("market-price")).toContainText("70,000");
  });

  test("a negative funding rate renders with its sign", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.funding.rate = "-2000000000000000"; // -0.002 → -0.2000%
      return w;
    });
    await expect(market.funding).toHaveText(/-0\.2000%/);
  });
});
