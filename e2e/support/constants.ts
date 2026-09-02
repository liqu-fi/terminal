/**
 * Shared constants for the hermetic (Tier 1) e2e suite.
 *
 * The dev server under test is launched by Playwright with these exact
 * VITE_GATEWAY_URL / VITE_RPC_URL values (see ../../playwright.config.ts), so
 * the mock interceptors know precisely which origins to capture.
 */

/** Fake gateway origin — never resolves; every request is intercepted. */
export const GATEWAY_URL = "https://gateway.e2e.local/v1";

/** Fake JSON-RPC origin — never resolves; every request is intercepted. */
export const RPC_URL = "https://rpc.e2e.local";

/** MegaETH testnet chain id used across the app. */
export const CHAIN_ID = 6343;

/** Deterministic test wallet (address only — signing is mocked, no key needed). */
export const TEST_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;

export interface Market {
  id: string;
  symbol: string;
  pythFeedId: string;
  /**
   * Начальная маржа в bps — то единственное, из чего выводится потолок плеча.
   *
   * @remarks Здесь не `maxLeverage` и не `minSize`: `GET /markets` их не слал
   * никогда, а мок слал — и тест на «размер ниже минимума» был зелёным на
   * фикстуре, которой в проде не существует. Мок повторяет контракт шлюза
   * 0.46.0, иначе он проверяет не экран, а сам себя.
   */
  initialMarginBps: string;
}

/** The default market the reference terminal trades. */
export const MARKET = {
  id: "200",
  symbol: "BTC",
  pythFeedId:
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  /** 400 bps = 4 % начальной маржи = потолок 25×. */
  initialMarginBps: "400",
} as const satisfies Market;

/** A second market, for multi-market scenarios (seed via `markets` in the world). */
export const MARKET_ETH = {
  id: "201",
  symbol: "ETH",
  pythFeedId:
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  /** 200 bps = 2 % = потолок 50×: два рынка с разными потолками. */
  initialMarginBps: "200",
} as const satisfies Market;

/** 10^18 helper for building 18-decimal fixture values. */
export const WAD = 10n ** 18n;
