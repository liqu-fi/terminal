import { AccountPage } from "../pages/AccountPage";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { ledgerRowFixture, readyWorld } from "../support/world";

test.describe("страница Account", () => {
  test("ссылка в шапке открывает страницу с четырьмя вкладками", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();

    await expect(page).toHaveURL(/#\/account$/);
    for (const slug of ["overview", "portfolio", "assets", "transactions"]) {
      await expect(account.tab(slug)).toBeVisible();
    }
    await expect(account.tab("overview")).toHaveAttribute("aria-current", "page");
    // Терминал размонтирован: на странице счёта его корня нет.
    await expect(page.getByTestId("terminal-root")).toHaveCount(0);
  });

  test("Overview: стоимость счёта, PnL за день и депозит в ленте", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();

    // getAvailableMargin из readyWorld — 5 000.
    await expect(account.stat("value")).toHaveText("$5,000.00");
    // Две точки фикстуры: заработано 120 при старте 5 000 → +2.40%.
    await expect(account.todayPnl).toHaveText("+$120.00 (+2.40%)");
    await expect(account.activityRows.first()).toContainText("Deposit");
    await expect(account.activityRows.first()).toContainText("+$2,500.00");
  });

  test("Assets: строка USDC показывает остаток на аккаунте", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();
    await account.tab("assets").click();

    // Мок-чейн отвечает на getCollateralAmount всем available аккаунта (5 000).
    await expect(account.assetRow("USDC")).toContainText("5,000");
  });

  test("Transactions: фильтр по типу оставляет только депозиты", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () =>
      readyWorld({ settlementLedger: [ledgerRowFixture()] }),
    );
    const account = new AccountPage(page);
    await account.open();
    await account.tab("transactions").click();

    // Фикстуры датированы 2024-м: окно 30 дней их не видит, берём всё время.
    await account.select("transactions-period", "all");
    await expect(account.transactionRows).toHaveCount(2);
    await expect(account.transactionsTable).toContainText("Trade");

    await account.select("transactions-type", "deposit");
    await expect(account.transactionRows).toHaveCount(1);
    await expect(account.transactionRows.first()).toContainText("Deposit");
  });

  test("ссылка Trade возвращает терминал", async ({ page, world }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();

    await account.tradeLink.click();
    await expect(page.getByTestId("terminal-root")).toBeVisible();
    await expect(account.root).toHaveCount(0);
  });
});
