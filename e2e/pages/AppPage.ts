/**
 * App-shell + session-gate Page Object, plus the onboarding flow helpers
 * (connect → create account → sign-in) that land a test in the live terminal.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export class AppPage {
  readonly brand: Locator;
  readonly connectButton: Locator;
  readonly walletAddressButton: Locator;
  readonly disconnectedGate: Locator;
  readonly noAccountGate: Locator;
  readonly createAccountButton: Locator;
  readonly needsSigninGate: Locator;
  readonly signinButton: Locator;
  readonly terminal: Locator;

  constructor(private readonly page: Page) {
    this.brand = page.getByTestId("app-brand");
    this.connectButton = page.getByTestId("connect-wallet-button");
    this.walletAddressButton = page.getByTestId("wallet-address-button");
    this.disconnectedGate = page.getByTestId("session-disconnected");
    this.noAccountGate = page.getByTestId("session-no-account");
    this.createAccountButton = page.getByTestId("create-account-button");
    this.needsSigninGate = page.getByTestId("session-needs-signin");
    this.signinButton = page.getByTestId("signin-button");
    this.terminal = page.getByTestId("terminal-root");
  }

  goto(): Promise<unknown> {
    return this.page.goto("/");
  }

  /** Click Connect (header + gate share the testid; either connects wagmi). */
  async connect(): Promise<void> {
    await this.connectButton.first().click();
    await expect(this.walletAddressButton).toBeVisible();
  }

  async createAccount(): Promise<void> {
    await this.createAccountButton.click();
    await expect(this.needsSigninGate).toBeVisible({ timeout: 15_000 });
  }

  async signIn(): Promise<void> {
    await this.signinButton.click();
    await expect(this.terminal).toBeVisible({ timeout: 15_000 });
  }

  /** From a connected wallet that already owns a perps account → terminal. */
  async signInToTerminal(): Promise<void> {
    await this.connect();
    await this.signIn();
  }

  /** Full cold onboarding: connect → mint account → enable book + sign-in. */
  async onboard(): Promise<void> {
    await this.connect();
    await this.createAccount();
    await this.signIn();
  }
}
