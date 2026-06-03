/** Convenience flow: seed a scenario, boot, connect + sign-in, and return the
 * full set of terminal Page Objects. */
import type { Page } from "@playwright/test";

import { seed } from "../support/fixtures";
import { type MockWorld, readyWorld } from "../support/world";
import { AppPage } from "./AppPage";
import {
  DepositDialog,
  MarketHeaderPanel,
  TradePanel,
  UserInfoPanel,
  WithdrawDialog,
} from "./TerminalPanels";

export interface Terminal {
  app: AppPage;
  market: MarketHeaderPanel;
  trade: TradePanel;
  userInfo: UserInfoPanel;
  deposit: DepositDialog;
  withdraw: WithdrawDialog;
}

/**
 * Seed the world (default {@link readyWorld}), boot the app, and drive
 * connect → sign-in into the live terminal. Pass a builder to customise state.
 */
export async function enterTerminal(
  page: Page,
  world: MockWorld,
  build: () => MockWorld = () => readyWorld(),
): Promise<Terminal> {
  seed(world, build());
  const app = new AppPage(page);
  await app.goto();
  await app.signInToTerminal();
  return {
    app,
    market: new MarketHeaderPanel(page),
    trade: new TradePanel(page),
    userInfo: new UserInfoPanel(page),
    deposit: new DepositDialog(page),
    withdraw: new WithdrawDialog(page),
  };
}
