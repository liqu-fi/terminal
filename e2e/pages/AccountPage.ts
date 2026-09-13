import { expect, type Locator, type Page } from "@playwright/test";

/** Страница `#/account`: навигация из шапки, вкладки, плитки, таблицы. */
export class AccountPage {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId("account-page");
  }
  get navLink(): Locator {
    return this.page.getByTestId("nav-account");
  }
  get tradeLink(): Locator {
    return this.page.getByTestId("nav-trade");
  }
  tab(slug: string): Locator {
    return this.page.getByTestId(`account-tab-${slug}`);
  }
  stat(slug: string): Locator {
    return this.page.getByTestId(`account-stat-${slug}`);
  }
  get todayPnl(): Locator {
    return this.page.getByTestId("today-pnl");
  }
  get activityRows(): Locator {
    return this.page.getByTestId("recent-activity-row");
  }
  assetRow(symbol: string): Locator {
    return this.page.getByTestId(`asset-row-${symbol}`);
  }
  get transactionsTable(): Locator {
    return this.page.getByTestId("transactions-table");
  }
  get transactionRows(): Locator {
    return this.page.locator('[data-testid^="transactions-table-row-"]');
  }

  /** Ссылка в шапке → страница на экране. */
  async open(): Promise<void> {
    await this.navLink.click();
    await expect(this.root).toBeVisible();
  }

  /** Radix Select: открыть триггер, выбрать пункт `${trigger}-${value}`. */
  async select(trigger: string, value: string): Promise<void> {
    await this.page.getByTestId(trigger).click();
    await this.page.getByTestId(`${trigger}-${value}`).click();
  }
}
