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
    // entryPrice = indexPrice - (totalPnl - accruedFunding)/size
    //            = 70,000 - 100/1 = 69,900  (proves the enriched-position math)
    await expect(row).toContainText("69,900");
  });

  test("shows the empty state with no positions", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world);
    await userInfo.selectTab("positions");
    await expect(userInfo.positionsEmpty).toBeVisible();
  });
});
