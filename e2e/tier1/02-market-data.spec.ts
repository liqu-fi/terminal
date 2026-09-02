import { AppPage } from "../pages/AppPage";
import { enterTerminal } from "../pages/flows";
import { MarketHeaderPanel } from "../pages/TerminalPanels";
import { MARKET, MARKET_ETH, WAD } from "../support/constants";
import { expect, seed, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("market data", () => {
  test("header renders market, price, funding and margin", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world);

    await expect(market.pill).toContainText("BTC");
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

  test("switching the market updates the header selection", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world, () =>
      readyWorld({ markets: [MARKET, MARKET_ETH] }),
    );
    // defaults to the first market, with both options available
    await expect(market.pill).toContainText("BTC");
    await market.pickMarket("201");
    await expect(market.pill).toContainText("ETH"); // switched to ETH
    await expect(market.price).toBeVisible(); // header still renders the new market
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

  test("a price fetch failure shows an em-dash, markets still loaded", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.priceStatus = 500;
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    const market = new MarketHeaderPanel(page);
    await expect(market.price).toContainText("—");
    await expect(market.pill).toContainText("BTC"); // markets loaded
  });

  test("a funding fetch failure shows an em-dash", async ({ page, world }) => {
    seed(world, readyWorld());
    world.faults.fundingStatus = 500;
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    await expect(new MarketHeaderPanel(page).funding).toContainText("—");
  });

  test("a candles fetch failure leaves the chart mounted and terminal usable", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.candlesStatus = 500;
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    await expect(app.terminal).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(new MarketHeaderPanel(page).price).toContainText("$70,000");
  });

  test("a single-market list renders exactly one option", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world); // default readyWorld → 1 market
    await market.openSearch();
    await expect(market.searchRows).toHaveCount(1);
  });

  test("switching market re-points the chart at the new market series", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world, () =>
      readyWorld({ markets: [MARKET, MARKET_ETH] }),
    );

    // Чарт больше не слушает SSE-канал закрытых минуток: он читает оракульный
    // ряд и домешивает живую цену. Доказательство переезда рынка — запрос
    // истории нового рынка, а не подписка старого механизма.
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("oracle-candles")) asked.push(r.url());
    });

    await market.pickMarket(MARKET_ETH.id);
    await expect
      .poll(() =>
        asked.some((u) =>
          u.includes(`/markets/${MARKET_ETH.id}/oracle-candles`),
        ),
      )
      .toBe(true);
  });
});
