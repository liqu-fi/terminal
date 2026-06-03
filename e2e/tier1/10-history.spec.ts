import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld, tradeFixture } from "../support/world";

test.describe("trade history", () => {
  test("renders past fills", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );

    await userInfo.selectTab("history");
    await expect(userInfo.historyTable).toBeVisible();
    await expect(userInfo.tradeRow("fill-1")).toBeVisible();
    await expect(userInfo.tradeRow("fill-1")).toContainText("BUY");
  });

  test("shows the empty state with no fills", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world);
    await userInfo.selectTab("history");
    await expect(userInfo.historyEmpty).toBeVisible();
  });
});
