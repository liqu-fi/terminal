import type { OrderBook, OrderBookLevel, DerivedMetrics } from '../types/market';
import Decimal from 'decimal.js';

// Binance depth stream response
interface BinanceDepthUpdate {
  e: string;      // Event type
  E: number;      // Event time
  s: string;      // Symbol
  U: number;      // First update ID in event
  u: number;      // Final update ID in event
  b: [string, string][]; // Bids [price, qty]
  a: [string, string][]; // Asks [price, qty]
}

// Binance REST snapshot response
interface BinanceDepthSnapshot {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

// Internal state
interface OrderBookState {
  symbol: string;
  bids: Map<string, string>;  // price -> quantity
  asks: Map<string, string>;
  lastUpdateId: number;
  localUpdateTime: number;
  isInitialized: boolean;
  pendingUpdates: BinanceDepthUpdate[];
  lastResyncTime: number;
  consecutiveFailures: number;
}

// 24h ticker data
interface Ticker24h {
  high24h: string;
  low24h: string;
  vol24h: string;
  priceChange24h: string;
  priceChangePercent24h: string;
}

// Metrics calculation helpers
interface MidPriceBuffer {
  prices: number[];
  index: number;
  count: number;
  sum: number;
  sumSq: number;
}

interface TradeBuffer {
  timestamps: number[];
  prices: number[];
  quantities: number[];
  index: number;
  count: number;
}

const DEPTH_LEVELS = 20;
const STALE_THRESHOLD_MS = 2000; // 从 500ms 增加到 2000ms，网络不稳定时更容忍
const RESYNC_COOLDOWN_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 3;
const VOLATILITY_WINDOW_SIZE = 60;
const TRADE_INTENSITY_WINDOW_MS = 10000;
const VWAP_WINDOW_MS = 60000;

export class OrderBookManager {
  private state: OrderBookState;
  private midPriceBuffer: MidPriceBuffer;
  private tradeBuffer: TradeBuffer;
  private ticker24h: Ticker24h;

  constructor(symbol: string) {
    this.state = {
      symbol,
      bids: new Map(),
      asks: new Map(),
      lastUpdateId: 0,
      localUpdateTime: 0,
      isInitialized: false,
      pendingUpdates: [],
      lastResyncTime: 0,
      consecutiveFailures: 0,
    };

    this.midPriceBuffer = {
      prices: new Array(VOLATILITY_WINDOW_SIZE).fill(0),
      index: 0,
      count: 0,
      sum: 0,
      sumSq: 0,
    };

    this.tradeBuffer = {
      timestamps: [],
      prices: [],
      quantities: [],
      index: 0,
      count: 0,
    };

    this.ticker24h = {
      high24h: '0',
      low24h: '0',
      vol24h: '0',
      priceChange24h: '0',
      priceChangePercent24h: '0',
    };
  }

  /**
   * Update 24h ticker data from websocket stream
   */
  updateTicker24h(data: {
    h: string;  // high
    l: string;  // low
    v: string;  // volume
    p: string;  // price change
    P: string;  // price change percent
  }): void {
    this.ticker24h = {
      high24h: data.h,
      low24h: data.l,
      vol24h: data.v,
      priceChange24h: data.p,
      priceChangePercent24h: data.P,
    };
  }

  /**
   * Apply snapshot from REST API
   */
  applySnapshot(snapshot: BinanceDepthSnapshot): void {
    this.state.bids.clear();
    this.state.asks.clear();

    for (const [price, qty] of snapshot.bids) {
      if (parseFloat(qty) > 0) {
        this.state.bids.set(price, qty);
      }
    }

    for (const [price, qty] of snapshot.asks) {
      if (parseFloat(qty) > 0) {
        this.state.asks.set(price, qty);
      }
    }

    this.state.lastUpdateId = snapshot.lastUpdateId;
    this.state.localUpdateTime = performance.now();
    this.state.isInitialized = true;
    this.state.consecutiveFailures = 0;

    // Process pending updates
    this.processPendingUpdates();
  }

  /**
   * Process a depth update from WebSocket
   * Returns: { success: boolean, needsResync: boolean }
   */
  processUpdate(update: BinanceDepthUpdate): { success: boolean; needsResync: boolean } {
    const now = performance.now();

    // 验证 symbol 是否匹配（双重保险）
    if (update.s && update.s.toUpperCase() !== this.state.symbol.toUpperCase()) {
      // 忽略不匹配的消息
      return { success: true, needsResync: false };
    }

    // Not initialized yet - buffer updates
    if (!this.state.isInitialized) {
      this.state.pendingUpdates.push(update);
      return { success: true, needsResync: false };
    }

    // Binance sequence validation rules:
    // 1. If U <= lastUpdateId + 1 AND u >= lastUpdateId + 1: valid update (overlaps or continues)
    // 2. If U > lastUpdateId + 1: gap detected (missing updates)
    // 3. If u < lastUpdateId + 1: update is too old (already processed), skip it

    // Check if update is too old (already processed)
    if (update.u < this.state.lastUpdateId + 1) {
      // Update is too old, skip it silently
      return { success: true, needsResync: false };
    }

    // Gap detection: U > lastUpdateId + 1
    if (update.U > this.state.lastUpdateId + 1) {
      this.state.consecutiveFailures++;
      
      // Check if we should trigger resync
      if (this.state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ||
          now - this.state.lastResyncTime > RESYNC_COOLDOWN_MS) {
        return { success: false, needsResync: true };
      }
      
      return { success: false, needsResync: false };
    }

    // Valid update: U <= lastUpdateId + 1 AND u >= lastUpdateId + 1
    // This means the update overlaps with or continues from our current state
    if (update.U <= this.state.lastUpdateId + 1 && update.u >= this.state.lastUpdateId + 1) {
      this.applyDelta(update);
      this.state.lastUpdateId = update.u;
      this.state.localUpdateTime = now;
      this.state.consecutiveFailures = 0;
      return { success: true, needsResync: false };
    }

    // Should not reach here, but handle gracefully
    return { success: false, needsResync: false };
  }

  /**
   * Apply delta updates to order book
   */
  private applyDelta(update: BinanceDepthUpdate): void {
    for (const [price, qty] of update.b) {
      if (parseFloat(qty) === 0) {
        this.state.bids.delete(price);
      } else {
        this.state.bids.set(price, qty);
      }
    }

    for (const [price, qty] of update.a) {
      if (parseFloat(qty) === 0) {
        this.state.asks.delete(price);
      } else {
        this.state.asks.set(price, qty);
      }
    }
  }

  /**
   * Process buffered updates after snapshot
   */
  private processPendingUpdates(): void {
    // Sort by U to ensure order
    this.state.pendingUpdates.sort((a, b) => a.U - b.U);

    for (const update of this.state.pendingUpdates) {
      // Only process updates that overlap with or come after snapshot
      // Valid: U <= lastUpdateId + 1 AND u >= lastUpdateId + 1
      if (update.U <= this.state.lastUpdateId + 1 && update.u >= this.state.lastUpdateId + 1) {
        const result = this.processUpdate(update);
        // If resync is needed, stop processing and let resync handle it
        if (result.needsResync) {
          break;
        }
      }
      // Skip updates that are too old (u < lastUpdateId + 1)
      // These were already included in the snapshot
    }

    this.state.pendingUpdates = [];
  }

  /**
   * Add trade for metrics calculation
   */
  addTrade(price: number, quantity: number, timestamp: number): void {
    this.tradeBuffer.timestamps.push(timestamp);
    this.tradeBuffer.prices.push(price);
    this.tradeBuffer.quantities.push(quantity);
    this.tradeBuffer.count++;

    // Clean up old trades
    const cutoff = timestamp - VWAP_WINDOW_MS;
    while (this.tradeBuffer.timestamps.length > 0 && this.tradeBuffer.timestamps[0]! < cutoff) {
      this.tradeBuffer.timestamps.shift();
      this.tradeBuffer.prices.shift();
      this.tradeBuffer.quantities.shift();
    }
  }

  /**
   * Update mid price for volatility calculation
   */
  updateMidPrice(mid: number): void {
    const buf = this.midPriceBuffer;
    
    // Remove old value from running stats
    if (buf.count >= VOLATILITY_WINDOW_SIZE) {
      const oldValue = buf.prices[buf.index]!;
      buf.sum -= oldValue;
      buf.sumSq -= oldValue * oldValue;
    }

    // Add new value
    buf.prices[buf.index] = mid;
    buf.sum += mid;
    buf.sumSq += mid * mid;
    buf.index = (buf.index + 1) % VOLATILITY_WINDOW_SIZE;
    buf.count = Math.min(buf.count + 1, VOLATILITY_WINDOW_SIZE);
  }

  /**
   * Check if order book needs resync due to stale data
   */
  checkStale(): boolean {
    if (!this.state.isInitialized) return true;
    return performance.now() - this.state.localUpdateTime > STALE_THRESHOLD_MS;
  }

  /**
   * Mark resync started
   */
  markResyncStart(): void {
    this.state.lastResyncTime = performance.now();
    this.state.isInitialized = false;
    this.state.pendingUpdates = [];
  }

  /**
   * Get current order book snapshot
   */
  getOrderBook(): OrderBook {
    const bids = this.getSortedLevels(this.state.bids, 'desc', DEPTH_LEVELS);
    const asks = this.getSortedLevels(this.state.asks, 'asc', DEPTH_LEVELS);

    return {
      symbol: this.state.symbol,
      bids,
      asks,
      lastUpdateId: this.state.lastUpdateId,
      localUpdateTime: this.state.localUpdateTime,
      isStale: this.checkStale(),
      depth: Math.min(bids.length, asks.length),
    };
  }

  /**
   * Calculate derived metrics
   */
  getMetrics(): DerivedMetrics {
    const orderBook = this.getOrderBook();
    const now = performance.now();

    // Get best bid/ask
    const bestBid = orderBook.bids[0];
    const bestAsk = orderBook.asks[0];

    if (!bestBid || !bestAsk) {
      return this.getEmptyMetrics(now);
    }

    const bestBidPrice = new Decimal(bestBid.price);
    const bestAskPrice = new Decimal(bestAsk.price);

    // Mid price
    const mid = bestBidPrice.plus(bestAskPrice).div(2);
    this.updateMidPrice(mid.toNumber());

    // Spread
    const spread = bestAskPrice.minus(bestBidPrice);
    const spreadBps = spread.div(mid).times(10000).toNumber();

    // Bid/Ask Imbalance (top 5 levels)
    const imbalance = this.calculateImbalance(orderBook);

    // Micro volatility (Welford online algorithm)
    const microVolatility = this.calculateVolatility();

    // Trade intensity
    const tradeIntensity = this.calculateTradeIntensity(now);

    // VWAP 60s
    const vwap60s = this.calculateVWAP(now);

    // Liquidity score
    const liquidityScore = this.calculateLiquidityScore(orderBook, spread);

    // Slippage estimate (for 0.1 BTC market order)
    const slippageEst = this.estimateSlippage(orderBook, '0.1', mid);

    // Depth volumes
    let bidDepthVolume = new Decimal(0);
    for (const b of orderBook.bids) {
      bidDepthVolume = bidDepthVolume.plus(b.quantity);
    }
    
    let askDepthVolume = new Decimal(0);
    for (const a of orderBook.asks) {
      askDepthVolume = askDepthVolume.plus(a.quantity);
    }

    return {
      mid: mid.toFixed(8),
      spread: spread.toFixed(8),
      spreadBps,
      bidAskImbalance: imbalance,
      microVolatility,
      tradeIntensity,
      vwap60s,
      liquidityScore,
      slippageEst,
      lastUpdateTime: now,
      bidDepthVolume: bidDepthVolume.toFixed(8),
      askDepthVolume: askDepthVolume.toFixed(8),
      // 24h ticker data
      high24h: this.ticker24h.high24h,
      low24h: this.ticker24h.low24h,
      vol24h: this.ticker24h.vol24h,
      priceChange24h: this.ticker24h.priceChange24h,
      priceChangePercent24h: this.ticker24h.priceChangePercent24h,
    };
  }

  private getSortedLevels(
    levels: Map<string, string>,
    order: 'asc' | 'desc',
    limit: number
  ): OrderBookLevel[] {
    const entries = Array.from(levels.entries());
    
    entries.sort((a, b) => {
      const diff = parseFloat(a[0]) - parseFloat(b[0]);
      return order === 'asc' ? diff : -diff;
    });

    return entries.slice(0, limit).map(([price, quantity]) => ({
      price,
      quantity,
    }));
  }

  private calculateImbalance(orderBook: OrderBook): number {
    const levels = 5;
    let bidQty = new Decimal(0);
    let askQty = new Decimal(0);

    for (let i = 0; i < levels && i < orderBook.bids.length; i++) {
      bidQty = bidQty.plus(orderBook.bids[i]!.quantity);
    }

    for (let i = 0; i < levels && i < orderBook.asks.length; i++) {
      askQty = askQty.plus(orderBook.asks[i]!.quantity);
    }

    const total = bidQty.plus(askQty);
    if (total.isZero()) return 0;

    return bidQty.minus(askQty).div(total).toNumber();
  }

  private calculateVolatility(): number {
    const buf = this.midPriceBuffer;
    if (buf.count < 2) return 0;

    const mean = buf.sum / buf.count;
    const variance = (buf.sumSq / buf.count) - (mean * mean);
    return Math.sqrt(Math.max(0, variance));
  }

  private calculateTradeIntensity(now: number): number {
    const cutoff = now - TRADE_INTENSITY_WINDOW_MS;
    return this.tradeBuffer.timestamps.filter(t => t >= cutoff).length;
  }

  private calculateVWAP(now: number): string {
    const cutoff = now - VWAP_WINDOW_MS;
    let sumPQ = new Decimal(0);
    let sumQ = new Decimal(0);

    for (let i = 0; i < this.tradeBuffer.timestamps.length; i++) {
      if (this.tradeBuffer.timestamps[i]! >= cutoff) {
        const price = new Decimal(this.tradeBuffer.prices[i]!);
        const qty = new Decimal(this.tradeBuffer.quantities[i]!);
        sumPQ = sumPQ.plus(price.times(qty));
        sumQ = sumQ.plus(qty);
      }
    }

    if (sumQ.isZero()) return '0';
    return sumPQ.div(sumQ).toFixed(8);
  }

  private calculateLiquidityScore(orderBook: OrderBook, spread: Decimal): number {
    // Calculate depth of top 10 levels
    let depth10 = new Decimal(0);
    const levels = 10;

    for (let i = 0; i < levels && i < orderBook.bids.length; i++) {
      const bid = orderBook.bids[i]!;
      depth10 = depth10.plus(new Decimal(bid.price).times(bid.quantity));
    }

    for (let i = 0; i < levels && i < orderBook.asks.length; i++) {
      const ask = orderBook.asks[i]!;
      depth10 = depth10.plus(new Decimal(ask.price).times(ask.quantity));
    }

    if (spread.isZero() || depth10.isZero()) return 0;

    // liquidityScore = clamp(50 + 10 * log10(depth10 / spread), 0, 100)
    const ratio = depth10.div(spread).toNumber();
    const score = 50 + 10 * Math.log10(ratio);
    return Math.max(0, Math.min(100, score));
  }

  private estimateSlippage(orderBook: OrderBook, quantity: string, mid: Decimal): string {
    const qty = new Decimal(quantity);
    let remaining = qty;
    let totalCost = new Decimal(0);

    // Simulate market buy
    for (const level of orderBook.asks) {
      if (remaining.lte(0)) break;

      const levelQty = new Decimal(level.quantity);
      const fillQty = Decimal.min(remaining, levelQty);
      totalCost = totalCost.plus(fillQty.times(level.price));
      remaining = remaining.minus(fillQty);
    }

    if (remaining.gt(0)) {
      // Not enough liquidity
      return 'N/A';
    }

    const avgPrice = totalCost.div(qty);
    const slippage = avgPrice.minus(mid).div(mid).times(10000); // in bps
    return slippage.toFixed(2);
  }

  private getEmptyMetrics(now: number): DerivedMetrics {
    return {
      mid: '0',
      spread: '0',
      spreadBps: 0,
      bidAskImbalance: 0,
      microVolatility: 0,
      tradeIntensity: 0,
      vwap60s: '0',
      liquidityScore: 0,
      slippageEst: 'N/A',
      lastUpdateTime: now,
      bidDepthVolume: '0',
      askDepthVolume: '0',
      // 24h ticker data (may still have valid data even without orderbook)
      high24h: this.ticker24h.high24h,
      low24h: this.ticker24h.low24h,
      vol24h: this.ticker24h.vol24h,
      priceChange24h: this.ticker24h.priceChange24h,
      priceChangePercent24h: this.ticker24h.priceChangePercent24h,
    };
  }

  get isInitialized(): boolean {
    return this.state.isInitialized;
  }

  get lastUpdateId(): number {
    return this.state.lastUpdateId;
  }
}





