/**
 * MockWorld — the single mutable source of truth a hermetic test drives.
 *
 * Every interceptor (mock chain, mock gateway, injected wallet) closes over the
 * same instance, so a write through the wallet (e.g. createAccount) mutates the
 * state that subsequent reads (accounts.list) and gateway responses observe —
 * exactly like a real backend, but deterministic and in-process.
 */
import { CHAIN_ID, MARKET, type Market, TEST_ADDRESS, WAD } from "./constants";

export type OrderMode = "BOOK" | "ONCHAIN" | "RECENTLY_CHANGED";

export interface PositionFixture {
  marketId: string;
  /** int256, 18-dec */
  totalPnl: bigint;
  /** int256, 18-dec */
  accruedFunding: bigint;
  /** int128, signed 18-dec (positive long, negative short) */
  positionSize: bigint;
}

export interface AccountFixture {
  id: bigint;
  orderMode: OrderMode;
  /** getAvailableMargin (int256, 18-dec) */
  available: bigint;
  /** getWithdrawableMargin (int256, 18-dec) */
  withdrawable: bigint;
  positions: PositionFixture[];
}

export interface GatewayOrder {
  id: string;
  accountId: string;
  marketId: string;
  /** signed 18-dec decimal string */
  sizeDelta: string;
  side: "BUY" | "SELL";
  orderType:
    | "MARKET"
    | "LIMIT"
    | "STOP_MARKET"
    | "STOP_LIMIT"
    | "TAKE_PROFIT_MARKET"
    | "TAKE_PROFIT_LIMIT";
  status: string;
  limitPrice: string | null;
  triggerPrice: string | null;
  createdAt: string;
}

export interface TradeRow {
  id: string;
  timestamp: number;
  marketId: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  takerAccountId: string;
  makerAccountId: string;
  takerOrderId: string;
  makerOrderId: string;
  txHash: string;
}

export interface RecordedTx {
  hash: string;
  to: string;
  data: string;
  kind: string;
}

export interface MockWorld {
  wallet: string;
  /** Chain the injected wallet reports (eth_chainId / net_version); mutable —
   * wallet_switchEthereumChain rewrites it and emits chainChanged. */
  chainId: number;
  accounts: AccountFixture[];
  /** index price (onchain indexPrice + entry-price math), 18-dec */
  indexPrice: bigint;
  /** gateway mark price (GET /markets/:id/price), 18-dec */
  price: bigint;
  markets: Market[];
  funding: {
    rate: string;
    velocity: string;
    index: string;
    predicted1h: string;
    predicted8h: string;
    updatedAt: string;
  };
  candles: Array<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    tradeCount: number;
    lastTradePrice: string | null;
  }>;
  openOrders: GatewayOrder[];
  conditionalOrders: GatewayOrder[];
  trades: TradeRow[];

  // --- fault injection ---
  faults: {
    // gateway: per-endpoint next-response status override
    submitOrderStatus?: number;
    marketsStatus?: number;
    authVerifyStatus?: number;
    cancelStatus?: number;
    // chain: make modifyCollateral (deposit/withdraw) txs revert on-chain
    collateralReverts?: boolean;
    // wallet: reject the next wallet_switchEthereumChain / every eth_sendTransaction
    switchChainRejects?: boolean;
    walletSendRejects?: boolean;
    // gateway: one-shot 422 INVALID_NONCE on the next POST /orders, naming
    // the expected nonce (drives the SDK's resync-and-retry path)
    submitNonceConflictExpected?: string;
  };

  // --- recordings (assertable from specs) ---
  submittedOrders: Array<Record<string, unknown>>;
  cancelledOrderIds: string[];
  /** signed amountDelta of the last modifyCollateral (deposit > 0, withdraw < 0) */
  lastCollateralDelta: bigint;
  sentTxs: RecordedTx[];
  authNonceRequests: number;
  authVerifyRequests: Array<{ message: string; signature: string }>;
  /** Count of `/auth/verify` calls rejected by `faults.authVerifyStatus`. */
  authVerifyRejections: number;
  registeredAccountIds: string[];
  /** Signing methods the wallet performed (personal_sign, eth_signTypedData_v4, …). */
  signRequests: string[];
  /** GET /orders/nonce — the seed the gateway hands the client, and a counter. */
  orderNonce: bigint;
  orderNonceRequests: number;

  // --- SSE frames to emit on the next /sse connection ---
  sseFrames: string[];

  // --- receipts the mock chain returns for sent txs ---
  receipts: Record<string, ReceiptLog[]>;

  // --- internal ---
  txCounter: number;
  accountCounter: bigint;
  blockNumber: bigint;
}

export interface ReceiptLog {
  address: string;
  topics: string[];
  data: string;
}

function defaultCandles(price: bigint): MockWorld["candles"] {
  const base = 1_717_200_000; // fixed; LWC only needs ascending unique seconds
  const p = price.toString();
  return Array.from({ length: 30 }, (_, i) => ({
    timestamp: base + i * 60,
    open: p,
    high: p,
    low: p,
    close: p,
    volume: WAD.toString(),
    tradeCount: 1,
    lastTradePrice: p,
  }));
}

export interface ScenarioOptions {
  accounts?: AccountFixture[];
  price?: bigint;
  markets?: Market[];
  openOrders?: GatewayOrder[];
  conditionalOrders?: GatewayOrder[];
  trades?: TradeRow[];
}

/** A connected wallet that owns NO perps account yet. */
export function freshWorld(opts: ScenarioOptions = {}): MockWorld {
  const price = opts.price ?? 70_000n * WAD;
  return {
    wallet: TEST_ADDRESS,
    chainId: CHAIN_ID,
    accounts: opts.accounts ?? [],
    indexPrice: price,
    price,
    markets: opts.markets ?? [MARKET],
    funding: {
      rate: "1000000000000000", // 0.001 -> "0.1000%"
      velocity: "0",
      index: "0",
      predicted1h: "1000000000000000",
      predicted8h: "1000000000000000",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    candles: defaultCandles(price),
    openOrders: opts.openOrders ?? [],
    conditionalOrders: opts.conditionalOrders ?? [],
    trades: opts.trades ?? [],
    faults: {},
    submittedOrders: [],
    cancelledOrderIds: [],
    lastCollateralDelta: 0n,
    sentTxs: [],
    authNonceRequests: 0,
    authVerifyRequests: [],
    authVerifyRejections: 0,
    registeredAccountIds: [],
    signRequests: [],
    // Must exceed the SDK's timestamp-derived initial nonce (BigInt(Date.now())
    // * 1000n ≈ 1.8e15): syncNonce is monotonic-MAX, so a lower seed would be
    // invisible. 8.8e18 stays above it for centuries.
    orderNonce: 8_888_888_888_888_888_888n,
    orderNonceRequests: 0,
    sseFrames: [],
    receipts: {},
    txCounter: 0,
    accountCounter: 1n,
    blockNumber: 1_000_000n,
  };
}

/** Account #1 in ONCHAIN mode, no margin — connected but must enable book + deposit. */
export function accountOnchainWorld(opts: ScenarioOptions = {}): MockWorld {
  return freshWorld({
    accounts: [
      {
        id: 1n,
        orderMode: "ONCHAIN",
        available: 0n,
        withdrawable: 0n,
        positions: [],
      },
    ],
    ...opts,
  });
}

/** Account #1 in BOOK mode, funded — connect then sign-in lands straight in the terminal. */
export function readyWorld(opts: ScenarioOptions = {}): MockWorld {
  return freshWorld({
    accounts: [
      {
        id: 1n,
        orderMode: "BOOK",
        available: 5_000n * WAD,
        withdrawable: 5_000n * WAD,
        positions: [],
      },
    ],
    ...opts,
  });
}

export function findAccount(
  world: MockWorld,
  id: bigint,
): AccountFixture | undefined {
  return world.accounts.find((a) => a.id === id);
}

export function nextTxHash(world: MockWorld): string {
  world.txCounter += 1;
  return ("0x" + world.txCounter.toString(16).padStart(64, "0")) as string;
}

/** A 1.0-BTC long limit order resting at $60k. */
export function limitOrderFixture(
  overrides: Partial<GatewayOrder> = {},
): GatewayOrder {
  return {
    id: "ord-limit-1",
    accountId: "1",
    marketId: MARKET.id,
    sizeDelta: WAD.toString(),
    side: "BUY",
    orderType: "LIMIT",
    status: "PENDING",
    limitPrice: (60_000n * WAD).toString(),
    triggerPrice: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A stop-market trigger order. */
export function conditionalOrderFixture(
  overrides: Partial<GatewayOrder> = {},
): GatewayOrder {
  return {
    id: "ord-cond-1",
    accountId: "1",
    marketId: MARKET.id,
    sizeDelta: (-WAD).toString(),
    side: "SELL",
    orderType: "STOP_MARKET",
    status: "TRIGGER_PENDING",
    limitPrice: null,
    triggerPrice: (80_000n * WAD).toString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function tradeFixture(overrides: Partial<TradeRow> = {}): TradeRow {
  return {
    id: "fill-1",
    timestamp: 1_717_200_000_000,
    marketId: MARKET.id,
    side: "BUY",
    price: (70_000n * WAD).toString(),
    size: WAD.toString(),
    takerAccountId: "1",
    makerAccountId: "2",
    takerOrderId: "ord-a",
    makerOrderId: "ord-b",
    txHash: "0x" + "ab".repeat(32),
    ...overrides,
  };
}

/** A raw SSE frame (`data: {...}\n\n`) carrying an order_update event. */
export function sseOrderUpdateFrame(orderId: string, status: string): string {
  const event = {
    type: "order_update",
    channel: `order:${orderId}`,
    data: { orderId, status },
  };
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function longPositionFixture(
  overrides: Partial<PositionFixture> = {},
): PositionFixture {
  return {
    marketId: MARKET.id,
    totalPnl: 100n * WAD,
    accruedFunding: 0n,
    positionSize: WAD, // +1.0 BTC long
    ...overrides,
  };
}
