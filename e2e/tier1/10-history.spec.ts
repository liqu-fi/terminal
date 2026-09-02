import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld, tradeFixture } from "../support/world";

test.describe("trade history", () => {
  test("renders past fills", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );

    await userInfo.selectTab("trade-history");
    await expect(userInfo.historyTable).toBeVisible();
    await expect(userInfo.tradeRow("fill-1")).toBeVisible();
    await expect(userInfo.tradeRow("fill-1")).toContainText("BUY");
    // the SDK string→bigint price normalization renders the $70,000 fill price
    await expect(userInfo.tradeRow("fill-1")).toContainText("70,000");
  });

  test("shows the empty state with no fills", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world);
    await userInfo.selectTab("trade-history");
    await expect(userInfo.historyEmpty).toBeVisible();
  });

  test("the history query requests this account's trades", async ({
    page,
    world,
  }) => {
    const tradesReq = page.waitForRequest((r) => r.url().includes("/trades"));
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );
    await userInfo.selectTab("trade-history");

    const url = new URL((await tradesReq).url());
    expect(url.searchParams.get("accountId")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  test("renders a SELL fill with short styling", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture({ id: "fill-sell", side: "SELL" })] }),
    );

    await userInfo.selectTab("trade-history");
    const row = userInfo.tradeRow("fill-sell");
    await expect(row).toBeVisible();
    await expect(row).toContainText("SELL");
    // the SELL side renders in the short (red) color
    // Сторона живёт в третьей ячейке; красным теперь бывает и PnL, поэтому
    // цвет проверяется на своей колонке, а не где угодно в строке.
    await expect(row.locator("td").nth(2).locator(".text-short")).toBeVisible();
  });
});
