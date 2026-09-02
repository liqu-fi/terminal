import { enterTerminal } from "../pages/flows";
import { MARKET, MARKET_ETH } from "../support/constants";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

const twoMarkets = () => readyWorld({ markets: [MARKET, MARKET_ETH] });

test.describe("market tabs", () => {
  test("выбранный рынок становится единственной вкладкой", async ({
    page,
    world,
  }) => {
    const { tabs } = await enterTerminal(page, world, twoMarkets);

    await expect(tabs.tab(MARKET.id)).toBeVisible();
    await expect(tabs.tab(MARKET.id)).toHaveAttribute("data-active", "true");
    await expect(tabs.tab(MARKET_ETH.id)).toHaveCount(0);
  });

  test("выбор второго рынка добавляет вкладку, не заменяя первую", async ({
    page,
    world,
  }) => {
    const { market, tabs } = await enterTerminal(page, world, twoMarkets);

    await market.pickMarket(MARKET_ETH.id);
    await expect(tabs.tab(MARKET.id)).toBeVisible();
    await expect(tabs.tab(MARKET_ETH.id)).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(tabs.tab(MARKET.id)).toHaveAttribute("data-active", "false");
  });

  test("последнюю вкладку закрыть нельзя", async ({ page, world }) => {
    const { tabs } = await enterTerminal(page, world, twoMarkets);

    await tabs.close(MARKET.id).click();
    // Пустая полоса означала бы экран без рынка — закрытие последней вкладки
    // не выполняется, а не выполняется наполовину.
    await expect(tabs.tab(MARKET.id)).toBeVisible();
  });

  test("переключатель %/$ меняет единицу изменения на вкладке", async ({
    page,
    world,
  }) => {
    const { tabs } = await enterTerminal(page, world, twoMarkets);

    // Оракульный ряд мира растёт ровно на 1 % от края до края.
    await expect(tabs.tab(MARKET.id)).toContainText("%", { timeout: 15_000 });

    await tabs.unit("usd").click();
    await expect(tabs.tab(MARKET.id)).toContainText("$");
    await expect(tabs.tab(MARKET.id)).not.toContainText("%");
  });
});
