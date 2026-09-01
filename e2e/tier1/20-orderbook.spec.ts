import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("order book panel", () => {
  test("панель видна и по умолчанию открыта на книге", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.root).toBeVisible();
    await expect(book.tab("book")).toHaveAttribute("data-state", "active");
  });

  test("503 показывается как «книгу никто не ведёт», а не как пустая книга", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ faults: { orderbookStatus: 503 } }),
    );
    await expect(book.unavailable).toBeVisible();
    await expect(book.empty).toHaveCount(0);
  });

  test("пустая живая книга — не отказ: торгует пул", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ orderbook: { bids: [], asks: [], asOf: Date.now() } }),
    );
    await expect(book.empty).toBeVisible();
    await expect(book.unavailable).toHaveCount(0);
  });
});
