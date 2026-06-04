import { MARKET, MARKET_ETH, WAD } from "../support/constants";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { longPositionFixture, readyWorld } from "../support/world";

test.describe("positions", () => {
  test("renders an open position row", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      return w;
    });

    await userInfo.selectTab("positions");
    await expect(userInfo.positionsTable).toBeVisible();
    const row = userInfo.positionRow("200");
    await expect(row).toBeVisible();
    await expect(row).toContainText("BTC");
    // Columns: Market=0, Size=1, Entry=2, uPnL=3, Liq=4. Scope each assertion to
    // its cell so the entry figure isn't satisfied by an identical Liq value.
    // entryPrice = indexPrice - (totalPnl - accruedFunding)/size = 70,000 - 100/1
    await expect(row.locator("td").nth(2)).toHaveText("69,900");
    // uPnL is positive ⇒ +$100.00 in the long (green) color
    await expect(row.locator("td").nth(3)).toHaveText("+$100.00");
    await expect(row.locator("td").nth(3)).toHaveClass(/text-long/);
  });

  test("shows the empty state with no positions", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world);
    await userInfo.selectTab("positions");
    await expect(userInfo.positionsEmpty).toBeVisible();
  });

  test("renders a short position with the short glyph and color", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      // negative positionSize ⇒ short side (the long fixture is +WAD)
      w.accounts[0].positions = [
        longPositionFixture({ positionSize: -WAD, totalPnl: -50n * WAD }),
      ];
      return w;
    });

    await userInfo.selectTab("positions");
    const row = userInfo.positionRow("200");
    await expect(row).toBeVisible();
    await expect(row).toContainText("BTC");
    await expect(row).toContainText("↓"); // short side glyph (long renders ↑)
    // the market cell color is purely side-driven (long ⇒ text-long)
    await expect(row.locator("td").first()).toHaveClass(/text-short/);
  });

  test("renders positions across multiple markets", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld({ markets: [MARKET, MARKET_ETH] });
      w.accounts[0].positions = [
        longPositionFixture({ marketId: "200" }), // BTC long
        longPositionFixture({
          marketId: "201", // ETH short
          positionSize: -WAD,
          totalPnl: -25n * WAD,
        }),
      ];
      return w;
    });

    await userInfo.selectTab("positions");
    // both rows render with the right symbol (keyed on a unique marketId)
    await expect(userInfo.positionRow("200")).toContainText("BTC");
    await expect(userInfo.positionRow("201")).toContainText("ETH");
  });
});
