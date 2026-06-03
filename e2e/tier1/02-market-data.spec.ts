import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

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
});
