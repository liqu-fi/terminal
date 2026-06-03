/** Page Objects for the live terminal: market header, trade panel, user-info
 * tables, and the deposit / withdraw dialogs. */
import { type Locator, type Page } from "@playwright/test";

type TradeTab = "market" | "limit" | "stop" | "take-profit";
type UserTab = "positions" | "open-orders" | "history";

export class MarketHeaderPanel {
  readonly root: Locator;
  readonly marketSelect: Locator;
  readonly price: Locator;
  readonly funding: Locator;
  readonly margin: Locator;
  readonly depositButton: Locator;
  readonly withdrawButton: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("market-header");
    this.marketSelect = page.getByTestId("market-select");
    this.price = page.getByTestId("market-price");
    this.funding = page.getByTestId("funding-rate");
    this.margin = page.getByTestId("available-margin");
    this.depositButton = page.getByTestId("open-deposit-button");
    this.withdrawButton = page.getByTestId("open-withdraw-button");
  }

  openDeposit(): Promise<void> {
    return this.depositButton.click();
  }
  openWithdraw(): Promise<void> {
    return this.withdrawButton.click();
  }
}

export class TradePanel {
  readonly root: Locator;
  readonly sideLong: Locator;
  readonly sideShort: Locator;
  readonly sizeInput: Locator;
  readonly leverageSlider: Locator;
  readonly leverageValue: Locator;
  readonly limitPriceInput: Locator;
  readonly triggerPriceInput: Locator;
  readonly triggerAbove: Locator;
  readonly triggerBelow: Locator;
  readonly submitButton: Locator;
  readonly insufficientMargin: Locator;
  readonly tradeError: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("trade-form");
    this.sideLong = page.getByTestId("side-long-button");
    this.sideShort = page.getByTestId("side-short-button");
    this.sizeInput = page.getByTestId("size-input");
    this.leverageSlider = page.getByTestId("leverage-slider");
    this.leverageValue = page.getByTestId("leverage-value");
    this.limitPriceInput = page.getByTestId("limit-price-input");
    this.triggerPriceInput = page.getByTestId("trigger-price-input");
    this.triggerAbove = page.getByTestId("trigger-above-button");
    this.triggerBelow = page.getByTestId("trigger-below-button");
    this.submitButton = page.getByTestId("submit-order-button");
    this.insufficientMargin = page.getByTestId("insufficient-margin");
    this.tradeError = page.getByTestId("trade-error");
  }

  tab(tab: TradeTab): Locator {
    return this.page.getByTestId(`trade-tab-${tab}`);
  }
  selectTab(tab: TradeTab): Promise<void> {
    return this.tab(tab).click();
  }
  setSize(value: string): Promise<void> {
    return this.sizeInput.fill(value);
  }
  setLimitPrice(value: string): Promise<void> {
    return this.limitPriceInput.fill(value);
  }
  setTriggerPrice(value: string): Promise<void> {
    return this.triggerPriceInput.fill(value);
  }

  /** input[type=range] can't be `.fill()`'d — set the value + fire events. */
  async setLeverage(value: number): Promise<void> {
    await this.leverageSlider.evaluate((el, v) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  }

  submit(): Promise<void> {
    return this.submitButton.click();
  }
}

export class UserInfoPanel {
  constructor(private readonly page: Page) {}

  tab(tab: UserTab): Locator {
    return this.page.getByTestId(`userinfo-tab-${tab}`);
  }
  selectTab(tab: UserTab): Promise<void> {
    return this.tab(tab).click();
  }

  get positionsTable(): Locator {
    return this.page.getByTestId("positions-table");
  }
  get positionsEmpty(): Locator {
    return this.page.getByTestId("positions-empty");
  }
  positionRow(marketId: string): Locator {
    return this.page.getByTestId(`position-row-${marketId}`);
  }

  get ordersTable(): Locator {
    return this.page.getByTestId("orders-table");
  }
  get ordersEmpty(): Locator {
    return this.page.getByTestId("orders-empty");
  }
  orderRow(id: string): Locator {
    return this.page.getByTestId(`order-row-${id}`);
  }
  cancelOrder(id: string): Promise<void> {
    return this.page.getByTestId(`cancel-order-${id}`).click();
  }

  get historyTable(): Locator {
    return this.page.getByTestId("history-table");
  }
  get historyEmpty(): Locator {
    return this.page.getByTestId("history-empty");
  }
  tradeRow(id: string): Locator {
    return this.page.getByTestId(`trade-row-${id}`);
  }
}

export class DepositDialog {
  readonly root: Locator;
  readonly amountInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("deposit-dialog");
    this.amountInput = page.getByTestId("deposit-amount-input");
    this.submitButton = page.getByTestId("deposit-submit-button");
    this.cancelButton = page.getByTestId("deposit-cancel-button");
    this.error = page.getByTestId("deposit-error");
  }

  async deposit(amount: string): Promise<void> {
    await this.amountInput.fill(amount);
    await this.submitButton.click();
  }
}

export class WithdrawDialog {
  readonly root: Locator;
  readonly amountInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("withdraw-dialog");
    this.amountInput = page.getByTestId("withdraw-amount-input");
    this.submitButton = page.getByTestId("withdraw-submit-button");
    this.cancelButton = page.getByTestId("withdraw-cancel-button");
    this.error = page.getByTestId("withdraw-error");
  }

  async withdraw(amount: string): Promise<void> {
    await this.amountInput.fill(amount);
    await this.submitButton.click();
  }
}
