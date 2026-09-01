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
  readonly sizeUnitToggle: Locator;
  readonly sizeMaxButton: Locator;
  readonly sizePctSlider: Locator;
  readonly sizePctValue: Locator;
  readonly leverageSlider: Locator;
  readonly leverageValue: Locator;
  readonly limitPriceInput: Locator;
  readonly triggerPriceInput: Locator;
  readonly triggerAbove: Locator;
  readonly triggerBelow: Locator;
  readonly submitButton: Locator;
  readonly insufficientMargin: Locator;
  readonly orderWarning: Locator;
  readonly tradeError: Locator;
  readonly preview: Locator;
  readonly orderSummary: Locator;
  readonly orderMargin: Locator;
  readonly orderLiqPrice: Locator;
  readonly tpslToggle: Locator;
  readonly entryTpInput: Locator;
  readonly entrySlInput: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("trade-form");
    this.sideLong = page.getByTestId("side-long-button");
    this.sideShort = page.getByTestId("side-short-button");
    this.sizeInput = page.getByTestId("size-input");
    this.sizeUnitToggle = page.getByTestId("size-unit-toggle");
    this.sizeMaxButton = page.getByTestId("size-max-button");
    this.sizePctSlider = page.getByTestId("size-pct-slider");
    this.sizePctValue = page.getByTestId("size-pct-value");
    this.leverageSlider = page.getByTestId("leverage-slider");
    this.leverageValue = page.getByTestId("leverage-value");
    this.limitPriceInput = page.getByTestId("limit-price-input");
    this.triggerPriceInput = page.getByTestId("trigger-price-input");
    this.triggerAbove = page.getByTestId("trigger-above-button");
    this.triggerBelow = page.getByTestId("trigger-below-button");
    this.submitButton = page.getByTestId("submit-order-button");
    this.insufficientMargin = page.getByTestId("insufficient-margin");
    this.orderWarning = page.getByTestId("order-warning");
    this.tradeError = page.getByTestId("trade-error");
    this.preview = page.getByTestId("trade-preview");
    this.orderSummary = page.getByTestId("order-summary");
    this.orderMargin = page.getByTestId("order-margin");
    this.orderLiqPrice = page.getByTestId("order-liq-price");
    this.tpslToggle = page.getByTestId("tpsl-toggle");
    this.entryTpInput = page.getByTestId("entry-tp-input");
    this.entrySlInput = page.getByTestId("entry-sl-input");
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
  toggleSizeUnit(): Promise<void> {
    return this.sizeUnitToggle.click();
  }
  clickMax(): Promise<void> {
    return this.sizeMaxButton.click();
  }
  sizePctChip(pct: 25 | 50 | 75 | 100): Locator {
    return this.page.getByTestId(`size-pct-${pct}`);
  }
  clickSizePct(pct: 25 | 50 | 75 | 100): Promise<void> {
    return this.sizePctChip(pct).click();
  }
  /** input[type=range] can't be `.fill()`'d — set the value + fire events. */
  async setSizePct(value: number): Promise<void> {
    await setRange(this.sizePctSlider, value);
  }
  setLimitPrice(value: string): Promise<void> {
    return this.limitPriceInput.fill(value);
  }
  setTriggerPrice(value: string): Promise<void> {
    return this.triggerPriceInput.fill(value);
  }

  /** input[type=range] can't be `.fill()`'d — set the value + fire events. */
  async setLeverage(value: number): Promise<void> {
    await setRange(this.leverageSlider, value);
  }

  submit(): Promise<void> {
    return this.submitButton.click();
  }
}

/** Drive a controlled `input[type=range]`: set the value + fire input/change. */
async function setRange(slider: Locator, value: number): Promise<void> {
  await slider.evaluate((el, v) => {
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

export class OrderBookPanel {
  readonly root: Locator;
  readonly unavailable: Locator;
  readonly empty: Locator;
  readonly error: Locator;
  readonly noMarket: Locator;
  readonly asks: Locator;
  readonly bids: Locator;
  readonly spread: Locator;
  readonly imbalance: Locator;
  readonly tapeRows: Locator;
  readonly tapeEmpty: Locator;
  readonly tapeLoading: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("orderbook-panel");
    this.unavailable = page.getByTestId("book-unavailable");
    this.empty = page.getByTestId("book-empty");
    this.error = page.getByTestId("book-error");
    this.noMarket = page.getByTestId("book-no-market");
    this.asks = page.locator('[data-testid^="book-ask-"]');
    this.bids = page.locator('[data-testid^="book-bid-"]');
    this.spread = page.getByTestId("book-spread");
    this.imbalance = page.getByTestId("book-imbalance");
    this.tapeRows = page.locator('[data-testid^="tape-row-"]');
    this.tapeEmpty = page.getByTestId("tape-empty");
    this.tapeLoading = page.getByTestId("tape-loading");
  }

  tab(name: "book" | "trades"): Locator {
    return this.page.getByTestId(`orderbook-tab-${name}`);
  }

  selectTab(name: "book" | "trades"): Promise<void> {
    return this.tab(name).click();
  }

  askRow(i: number): Locator {
    return this.page.getByTestId(`book-ask-${i}`);
  }
  bidRow(i: number): Locator {
    return this.page.getByTestId(`book-bid-${i}`);
  }
  setView(v: "both" | "bids" | "asks"): Promise<void> {
    return this.page.getByTestId(`book-view-${v}`).click();
  }
  async selectTick(index: number): Promise<void> {
    await this.page.getByTestId("book-tick-select").click();
    await this.page.getByTestId(`book-tick-option-${index}`).click();
  }
}

export class LayoutPanel {
  readonly chartPanel: Locator;
  readonly chartCollapseToggle: Locator;
  readonly bottomPanel: Locator;
  readonly bottomFullscreenToggle: Locator;

  constructor(page: Page) {
    this.chartPanel = page.getByTestId("chart-panel");
    this.chartCollapseToggle = page.getByTestId("chart-collapse-toggle");
    this.bottomPanel = page.getByTestId("bottom-panel");
    this.bottomFullscreenToggle = page.getByTestId("bottom-fullscreen-toggle");
  }

  toggleChart(): Promise<void> {
    return this.chartCollapseToggle.click();
  }

  toggleBottomFullscreen(): Promise<void> {
    return this.bottomFullscreenToggle.click();
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

  get positionsLoading(): Locator {
    return this.page.getByTestId("positions-loading");
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
  readonly overlay: Locator;
  readonly amountInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;
  readonly balance: Locator;
  readonly maxButton: Locator;
  readonly validation: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("deposit-dialog");
    this.overlay = page.getByTestId("dialog-overlay");
    this.amountInput = page.getByTestId("deposit-amount-input");
    this.submitButton = page.getByTestId("deposit-submit-button");
    this.cancelButton = page.getByTestId("deposit-cancel-button");
    this.error = page.getByTestId("deposit-error");
    this.balance = page.getByTestId("deposit-balance");
    this.maxButton = page.getByTestId("deposit-max-button");
    this.validation = page.getByTestId("deposit-validation");
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
  readonly debtNotice: Locator;
  readonly balance: Locator;
  readonly maxButton: Locator;
  readonly validation: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("withdraw-dialog");
    this.amountInput = page.getByTestId("withdraw-amount-input");
    this.submitButton = page.getByTestId("withdraw-submit-button");
    this.cancelButton = page.getByTestId("withdraw-cancel-button");
    this.error = page.getByTestId("withdraw-error");
    this.debtNotice = page.getByTestId("withdraw-debt-notice");
    this.balance = page.getByTestId("withdraw-balance");
    this.maxButton = page.getByTestId("withdraw-max-button");
    this.validation = page.getByTestId("withdraw-validation");
  }

  async withdraw(amount: string): Promise<void> {
    await this.amountInput.fill(amount);
    await this.submitButton.click();
  }
}
