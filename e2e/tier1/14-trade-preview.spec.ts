import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("trade preview", () => {
  test("entering a size reveals fill, fee, impact and notional", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await expect(trade.preview).toBeHidden(); // nothing to preview yet

    await trade.setSize("1");
    // 300ms debounce + onchain multicall, then the row appears:
    await expect(trade.preview).toBeVisible();
    // 1 BTC @ $70k mark, flat mock fill, positive default skew ⇒ BUY is taker.
    // The fill assertion is row-paired (label+value in one row div): a bare
    // containText("70,000") would also match the notional's "$70,000.00".
    await expect(
      trade.preview.locator("div").filter({ hasText: "Est. fill" }),
    ).toContainText("70,000"); // fill == mark
    await expect(trade.preview).toContainText("$42.00"); // 6bp taker fee
    await expect(trade.preview).toContainText("0.00%"); // zero impact
    await expect(trade.preview).toContainText("$70,000.00"); // notional
  });

  test("growing the size scales the preview", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.setSize("1");
    await expect(trade.preview).toContainText("$70,000.00");

    await trade.setSize("2");
    await expect(trade.preview).toContainText("$140,000.00"); // notional ×2
    await expect(trade.preview).toContainText("$84.00"); // fee ×2
  });

  test("the preview renders for a short (negative sizeDelta)", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.sideShort.click();
    await trade.setSize("1");

    await expect(trade.preview).toBeVisible();
    await expect(trade.preview).toContainText("$70,000.00"); // notional, sign-independent
  });

  test("clearing the size hides the preview", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.setSize("1");
    await expect(trade.preview).toBeVisible();

    await trade.setSize("");
    await expect(trade.preview).toBeHidden();
  });
});
