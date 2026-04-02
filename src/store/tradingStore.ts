import { create } from 'zustand';
import type { PaperOrder, Position } from '../types/trading';

interface TradingState {
  orders: PaperOrder[];
  positions: Map<string, Position>;
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;
  updateOrderBookForMatching: (orderBook: unknown) => void;
  getOpenOrders: () => PaperOrder[];
  getConditionalOrders: () => PaperOrder[];
  getOrderHistory: () => PaperOrder[];
  getPosition: (symbol: string) => Position | undefined;
  getOCOOrders: () => PaperOrder[];
  resetAccount: () => void;
  cancelOrder: (clientOrderId: string) => void;
  createOrder: (params: Record<string, unknown>, midPrice?: string) => PaperOrder | null;
  createOCOOrder: (params: Record<string, unknown>) => PaperOrder | null;
  createTrailingStopOrder: (params: Record<string, unknown>) => PaperOrder | null;
}

export const useTradingStore = create<TradingState>()((set) => ({
  orders: [],
  positions: new Map(),
  focusMode: false,
  setFocusMode: (enabled: boolean) => set({ focusMode: enabled }),
  updateOrderBookForMatching: () => {},
  getOpenOrders: () => [],
  getConditionalOrders: () => [],
  getOrderHistory: () => [],
  getPosition: () => undefined,
  getOCOOrders: () => [],
  resetAccount: () => {},
  cancelOrder: () => {
    console.warn('[tradingStore] Order cancellation not yet available (Phase 3)');
  },
  createOrder: () => {
    console.warn('[tradingStore] Order submission not yet available (Phase 3)');
    return null;
  },
  createOCOOrder: () => {
    console.warn('[tradingStore] OCO order creation not yet available (Phase 3)');
    return null;
  },
  createTrailingStopOrder: () => {
    console.warn('[tradingStore] Trailing stop order creation not yet available (Phase 3)');
    return null;
  },
}));

export const selectFocusMode = (state: TradingState) => state.focusMode;
export const selectPositions = (state: TradingState) => state.positions;
