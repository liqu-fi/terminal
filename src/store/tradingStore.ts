import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type {
  PaperOrder,
  Fill,
  Position,
  OrderStatus,
  OrderSide,
  OrderType,
} from '../types/trading';
import type { OrderBook } from '../types/market';
import { useWalletStore } from './walletStore';
import { useMarketStore } from './marketStore';
import { notification } from './notificationStore';

// ===== Constants =====
const FEE_RATE = 0.001; // 0.1% fee
const SIMULATED_DELAY_MIN_MS = 50;
const SIMULATED_DELAY_MAX_MS = 200;

interface TradingState {
  orders: PaperOrder[];
  positions: Map<string, Position>;
  focusMode: boolean;
  createOrder: (params: CreateOrderParams, currentMarketPrice?: string) => PaperOrder | null;
  cancelOrder: (clientOrderId: string) => boolean;
  updateOrderBookForMatching: (orderBook: OrderBook) => void;
  checkTPSL: (symbol: string, midPrice: string) => void;
  setFocusMode: (enabled: boolean) => void;
  updatePositionTPSL: (symbol: string, takeProfitPrice?: string, stopLossPrice?: string) => void;
  resetAccount: () => void;
  getOrder: (clientOrderId: string) => PaperOrder | undefined;
  getOpenOrders: () => PaperOrder[];
  getOrderHistory: () => PaperOrder[];
  getPosition: (symbol: string) => Position | undefined;
}

interface CreateOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: string;
  quantity: string;
  takeProfitPrice?: string;
  stopLossPrice?: string;
}

const customStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      const parsed = JSON.parse(str);
      if (parsed.state?.positions && Array.isArray(parsed.state.positions)) {
        parsed.state.positions = new Map(parsed.state.positions);
      }
      return parsed;
    } catch (e) { return null; }
  },
  setItem: (name: string, value: { state: TradingState; version?: number }) => {
    try {
      const toStore = { ...value, state: { ...value.state, positions: value.state.positions instanceof Map ? Array.from(value.state.positions.entries()) : value.state.positions } };
      localStorage.setItem(name, JSON.stringify(toStore));
    } catch (e) {}
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        orders: [],
        positions: new Map(),
        focusMode: false,

        createOrder: (params, currentMarketPrice) => {
          const { symbol, side, type, price, quantity, takeProfitPrice, stopLossPrice } = params;
          const walletStore = useWalletStore.getState();
          const marketStore = useMarketStore.getState();

          // Data Confidence Check
          const confidence = marketStore.dataConfidence;
          if (confidence.level === 'stale' || confidence.level === 'resyncing') {
            notification.error(`order:block:${Date.now()}`, `EXECUTION_BLOCKED: Data Integrity Critical (${confidence.level})`);
            return null;
          }

          if (!quantity || parseFloat(quantity) <= 0) return null;
          if (type === 'limit' && (!price || parseFloat(price) <= 0)) return null;

          const baseAsset = symbol.replace('USDT', '');
          const quoteAsset = 'USDT';
          let requiredAmount: string;
          let assetToCheck: string;

          if (side === 'buy') {
            assetToCheck = quoteAsset;
            if (type === 'limit') requiredAmount = new Decimal(price!).times(quantity).toFixed(8);
            else {
              if (!currentMarketPrice) return null;
              requiredAmount = new Decimal(currentMarketPrice).times(quantity).times(1.05).toFixed(8);
            }
          } else {
            assetToCheck = baseAsset;
            requiredAmount = quantity;
          }

          const balance = walletStore.getBalance(assetToCheck);
          if (!balance || new Decimal(balance.available).lt(requiredAmount)) {
            notification.error(`order:balance:${Date.now()}`, 'INSUFFICIENT_MARGIN: Order rejected by engine');
            return null;
          }

          const now = Date.now();
          const order: PaperOrder = {
            clientOrderId: uuidv4(),
            symbol, side, type,
            price: type === 'limit' ? price! : null,
            quantity, filledQty: '0', avgPrice: '0',
            status: 'pending', createdAt: now, updatedAt: now,
            fills: [], takeProfitPrice, stopLossPrice,
          };

          set((state) => ({ orders: [order, ...state.orders] }));

          setTimeout(() => {
            const currentState = get();
            const walletState = useWalletStore.getState();
            const currentOrder = currentState.orders.find(o => o.clientOrderId === order.clientOrderId);
            
            if (!currentOrder || currentOrder.status !== 'pending') return;

            let freezeAmount: string;
            let freezeAsset: string;

            if (currentOrder.side === 'buy') {
              freezeAsset = quoteAsset;
              if (currentOrder.type === 'limit') freezeAmount = new Decimal(currentOrder.price!).times(currentOrder.quantity).toFixed(8);
              else freezeAmount = new Decimal(currentMarketPrice || '0').times(currentOrder.quantity).times(1.05).toFixed(8);
            } else {
              freezeAsset = baseAsset;
              freezeAmount = currentOrder.quantity;
            }

            const frozen = walletState.freezeBalance(freezeAsset, freezeAmount, order.clientOrderId, 'order');

            if (!frozen) {
              set((s) => ({ orders: s.orders.map(o => o.clientOrderId === order.clientOrderId ? { ...o, status: 'rejected', rejectReason: 'Insufficient balance', updatedAt: Date.now() } : o) }));
              return;
            }

            set((s) => ({ orders: s.orders.map(o => o.clientOrderId === order.clientOrderId ? { ...o, status: 'open', updatedAt: Date.now() } : o) }));
            
            const ms = useMarketStore.getState();
            if (ms.orderBook && ms.orderBook.symbol === order.symbol) get().updateOrderBookForMatching(ms.orderBook);
          }, SIMULATED_DELAY_MIN_MS + Math.random() * (SIMULATED_DELAY_MAX_MS - SIMULATED_DELAY_MIN_MS));

          return order;
        },

        cancelOrder: (clientOrderId) => {
          const state = get();
          const walletStore = useWalletStore.getState();
          const order = state.orders.find(o => o.clientOrderId === clientOrderId);
          if (!order || !['pending', 'open', 'partial'].includes(order.status)) return false;

          const baseAsset = order.symbol.replace('USDT', '');
          const quoteAsset = 'USDT';
          const remainingQty = new Decimal(order.quantity).minus(order.filledQty);

          if (remainingQty.gt(0)) {
            let unfreezeAmount: string;
            let unfreezeAsset: string;
            if (order.side === 'buy') {
              unfreezeAsset = quoteAsset;
              unfreezeAmount = order.type === 'limit' ? new Decimal(order.price!).times(remainingQty).toFixed(8) : remainingQty.times(100000).toFixed(8);
            } else {
              unfreezeAsset = baseAsset;
              unfreezeAmount = remainingQty.toFixed(8);
            }
            walletStore.unfreezeBalance(unfreezeAsset, unfreezeAmount, clientOrderId, 'order');
          }

          set((s) => ({ orders: s.orders.map(o => o.clientOrderId === clientOrderId ? { ...o, status: 'cancelled', updatedAt: Date.now() } : o) }));
          return true;
        },

        updateOrderBookForMatching: (orderBook) => {
          const state = get();
          const walletStore = useWalletStore.getState();
          const openOrders = state.orders.filter(o => o.symbol === orderBook.symbol && (o.status === 'open' || o.status === 'partial'));
          if (openOrders.length === 0) return;

          const bestBid = orderBook.bids[0];
          const bestAsk = orderBook.asks[0];
          if (!bestBid || !bestAsk) return;

          const midPrice = new Decimal(bestBid.price).plus(bestAsk.price).div(2).toFixed(8);
          get().checkTPSL(orderBook.symbol, midPrice);

          const updates: { order: PaperOrder; fills: Fill[]; newStatus: OrderStatus }[] = [];
          for (const order of openOrders) {
            const matchResult = attemptMatch(order, orderBook);
            if (matchResult.fills.length > 0) {
              updates.push({ order, fills: matchResult.fills, newStatus: matchResult.fullyFilled ? 'filled' : 'partial' });
            }
          }

          if (updates.length === 0) return;

          set((s) => {
            const newPositions = new Map(s.positions);
            const newOrders = s.orders.map(o => {
              const update = updates.find(u => u.order.clientOrderId === o.clientOrderId);
              if (!update) return o;

              const allFills = [...o.fills, ...update.fills];
              const totalFilledQty = allFills.reduce((sum, f) => sum.plus(f.quantity), new Decimal(0));
              const totalCost = allFills.reduce((sum, f) => sum.plus(new Decimal(f.price).times(f.quantity)), new Decimal(0));
              const avgPrice = totalFilledQty.gt(0) ? totalCost.div(totalFilledQty).toFixed(8) : '0';

              const baseAsset = o.symbol.replace('USDT', '');
              const quoteAsset = 'USDT';

              for (const fill of update.fills) {
                const fillQty = new Decimal(fill.quantity);
                const fillCost = new Decimal(fill.price).times(fillQty);
                const fee = new Decimal(fill.fee);

                if (o.side === 'buy') {
                  walletStore.deductFromFrozen(quoteAsset, fillCost.toFixed(8), fee.toFixed(8), fill.fillId, 'fill');
                  walletStore.creditToAvailable(baseAsset, fillQty.toFixed(8), fill.fillId, 'fill');
                } else {
                  walletStore.deductFromFrozen(baseAsset, fillQty.toFixed(8), '0', fill.fillId, 'fill');
                  walletStore.creditToAvailable(quoteAsset, fillCost.minus(fee).toFixed(8), fill.fillId, 'fill');
                }
              }

              const position = updatePosition(newPositions.get(o.symbol), o, update.fills);
              newPositions.set(o.symbol, position);

              return { ...o, fills: allFills, filledQty: totalFilledQty.toFixed(8), avgPrice, status: update.newStatus, updatedAt: Date.now() };
            });
            return { orders: newOrders, positions: newPositions };
          });
        },

        checkTPSL: (symbol, midPriceStr) => {
          const state = get();
          const position = state.positions.get(symbol);
          if (!position || position.side === 'flat') return;

          const midPrice = new Decimal(midPriceStr);
          const { takeProfitPrice, stopLossPrice, quantity } = position;
          let shouldTrigger = false;

          if (takeProfitPrice && midPrice.gte(takeProfitPrice)) shouldTrigger = true;
          else if (stopLossPrice && midPrice.lte(stopLossPrice)) shouldTrigger = true;

          if (shouldTrigger) {
            get().createOrder({ symbol, side: 'sell', type: 'market', quantity }, midPriceStr);
            get().updatePositionTPSL(symbol, undefined, undefined);
          }
        },

        setFocusMode: (enabled) => set({ focusMode: enabled }),

        updatePositionTPSL: (symbol, takeProfitPrice, stopLossPrice) => {
          set((s) => {
            const newPositions = new Map(s.positions);
            const position = newPositions.get(symbol);
            if (position) newPositions.set(symbol, { ...position, takeProfitPrice, stopLossPrice, updatedAt: Date.now() });
            return { positions: newPositions };
          });
        },

        resetAccount: () => {
          useWalletStore.getState().resetWallet();
          set({ orders: [], positions: new Map() });
        },

        getOrder: (id) => get().orders.find(o => o.clientOrderId === id),
        getOpenOrders: () => get().orders.filter(o => ['open', 'partial', 'pending', 'submitted'].includes(o.status)),
        getOrderHistory: () => get().orders.filter(o => ['filled', 'cancelled', 'rejected'].includes(o.status)),
        getPosition: (symbol) => get().positions.get(symbol),
      }),
      {
        name: 'paper-trading-storage',
        version: 3,
        storage: customStorage as any,
        partialize: (s) => ({ orders: s.orders, positions: s.positions, focusMode: false }),
      }
    )
  )
);

// ===== Selectors =====
export const selectOrders = (state: TradingState) => state.orders;
export const selectOpenOrders = (state: TradingState) => state.getOpenOrders();
export const selectFocusMode = (state: TradingState) => state.focusMode;
export const selectPositions = (state: TradingState) => state.positions;

function attemptMatch(order: PaperOrder, orderBook: OrderBook): { fills: Fill[]; fullyFilled: boolean } {
  const fills: Fill[] = [];
  let remainingQty = new Decimal(order.quantity).minus(order.filledQty);
  if (remainingQty.lte(0)) return { fills: [], fullyFilled: true };

  const levels = order.side === 'buy' ? orderBook.asks : orderBook.bids;
  for (const level of levels) {
    if (remainingQty.lte(0)) break;
    const levelPrice = new Decimal(level.price);
    const levelQty = new Decimal(level.quantity);
    let canMatch = order.type === 'market' || (order.side === 'buy' ? new Decimal(order.price!).gte(levelPrice) : new Decimal(order.price!).lte(levelPrice));
    if (!canMatch) break;

    const fillQty = Decimal.min(remainingQty, levelQty);
    const fee = fillQty.times(levelPrice).times(FEE_RATE);
    fills.push({ fillId: `fill_${uuidv4().slice(0, 8)}`, price: level.price, quantity: fillQty.toFixed(8), fee: fee.toFixed(8), feeAsset: 'USDT', time: Date.now() });
    remainingQty = remainingQty.minus(fillQty);
  }
  return { fills, fullyFilled: remainingQty.lte(0) };
}

function updatePosition(currentPosition: Position | undefined, order: PaperOrder, fills: Fill[]): Position {
  const symbol = order.symbol;
  const now = Date.now();
  if (!currentPosition) {
    currentPosition = { symbol, side: 'flat', quantity: '0', avgEntryPrice: '0', unrealizedPnl: '0', realizedPnl: '0', updatedAt: now, takeProfitPrice: order.takeProfitPrice, stopLossPrice: order.stopLossPrice };
  } else {
    if (order.takeProfitPrice) currentPosition.takeProfitPrice = order.takeProfitPrice;
    if (order.stopLossPrice) currentPosition.stopLossPrice = order.stopLossPrice;
  }

  let positionQty = new Decimal(currentPosition.quantity);
  let avgEntry = new Decimal(currentPosition.avgEntryPrice);
  let realizedPnl = new Decimal(currentPosition.realizedPnl);

  for (const fill of fills) {
    const fillQty = new Decimal(fill.quantity);
    const fillPrice = new Decimal(fill.price);
    if (order.side === 'buy') {
      const newQty = positionQty.plus(fillQty);
      avgEntry = positionQty.gt(0) ? positionQty.times(avgEntry).plus(fillQty.times(fillPrice)).div(newQty) : fillPrice;
      positionQty = newQty;
    } else {
      if (positionQty.gt(0)) realizedPnl = realizedPnl.plus(fillQty.times(fillPrice.minus(avgEntry)));
      positionQty = positionQty.minus(fillQty);
    }
  }
  return { symbol, side: positionQty.gt(0) ? 'long' : 'flat', quantity: Decimal.max(positionQty, 0).toFixed(8), avgEntryPrice: avgEntry.toFixed(8), unrealizedPnl: '0', realizedPnl: realizedPnl.toFixed(8), updatedAt: now };
}
