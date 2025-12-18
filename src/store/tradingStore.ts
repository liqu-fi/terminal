import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type {
  PaperOrder,
  Fill,
  Position,
  AccountBalance,
  OrderStatus,
  OrderSide,
  OrderType,
  VALID_ORDER_TRANSITIONS,
} from '../types/trading';
import type { OrderBook } from '../types/market';

// ===== Constants =====
const FEE_RATE = 0.001; // 0.1% fee
const SIMULATED_DELAY_MIN_MS = 50;
const SIMULATED_DELAY_MAX_MS = 200;

// ===== Initial Balances =====
const INITIAL_BALANCES: AccountBalance[] = [
  { asset: 'USDT', free: '100000', locked: '0', total: '100000' },
  { asset: 'BTC', free: '0', locked: '0', total: '0' },
  { asset: 'ETH', free: '0', locked: '0', total: '0' },
  { asset: 'BNB', free: '0', locked: '0', total: '0' },
  { asset: 'SOL', free: '0', locked: '0', total: '0' },
  { asset: 'XRP', free: '0', locked: '0', total: '0' },
];

// ===== Store State =====
interface TradingState {
  // Orders
  orders: PaperOrder[];
  
  // Positions
  positions: Map<string, Position>;
  
  // Balances
  balances: AccountBalance[];
  
  // Focus mode
  focusMode: boolean;
  
  // Actions
  createOrder: (params: CreateOrderParams, currentMarketPrice?: string) => PaperOrder | null;
  cancelOrder: (clientOrderId: string) => boolean;
  updateOrderBookForMatching: (orderBook: OrderBook) => void;
  setFocusMode: (enabled: boolean) => void;
  resetAccount: () => void;
  
  // Getters
  getOrder: (clientOrderId: string) => PaperOrder | undefined;
  getOpenOrders: () => PaperOrder[];
  getOrderHistory: () => PaperOrder[];
  getPosition: (symbol: string) => Position | undefined;
  getBalance: (asset: string) => AccountBalance | undefined;
}

interface CreateOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: string;
  quantity: string;
}

// Valid transitions map
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['submitted', 'cancelled'],
  submitted: ['open', 'rejected'],
  open: ['partial', 'filled', 'cancelled'],
  partial: ['filled', 'cancelled'],
  filled: [],
  cancelled: [],
  rejected: [],
};

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        orders: [],
        positions: new Map(),
        balances: [...INITIAL_BALANCES],
        focusMode: false,

        // Create a new order
        createOrder: (params, currentMarketPrice?: string) => {
          const { symbol, side, type, price, quantity } = params;
          const state = get();

          // Validate
          if (!quantity || parseFloat(quantity) <= 0) {
            console.error('Invalid quantity');
            return null;
          }

          if (type === 'limit' && (!price || parseFloat(price) <= 0)) {
            console.error('Limit order requires valid price');
            return null;
          }

          // Extract base and quote assets
          const baseAsset = symbol.replace('USDT', '');
          const quoteAsset = 'USDT';

          // Check balance
          if (side === 'buy') {
            // Need quote asset (USDT)
            const quoteBalance = state.balances.find(b => b.asset === quoteAsset);
            
            // 计算所需金额：限价单用指定价格，市价单用当前市场价格（带 5% 缓冲）
            let requiredAmount: Decimal;
            if (type === 'limit') {
              requiredAmount = new Decimal(price!).times(quantity);
            } else {
              // 市价单：使用传入的市场价格，如果没有则拒绝
              if (!currentMarketPrice) {
                console.error('Market order requires current market price');
                return null;
              }
              // 添加 5% 缓冲以应对价格波动
              requiredAmount = new Decimal(currentMarketPrice).times(quantity).times(1.05);
            }
            
            if (!quoteBalance || new Decimal(quoteBalance.free).lt(requiredAmount)) {
              console.error('Insufficient balance', { 
                required: requiredAmount.toString(), 
                available: quoteBalance?.free 
              });
              return null;
            }
          } else {
            // Need base asset
            const baseBalance = state.balances.find(b => b.asset === baseAsset);
            if (!baseBalance || new Decimal(baseBalance.free).lt(quantity)) {
              console.error('Insufficient balance', {
                required: quantity,
                available: baseBalance?.free
              });
              return null;
            }
          }

          // Create order
          const now = Date.now();
          const order: PaperOrder = {
            clientOrderId: uuidv4(),
            symbol,
            side,
            type,
            price: type === 'limit' ? price! : null,
            quantity,
            filledQty: '0',
            avgPrice: '0',
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            fills: [],
          };

          // Add to orders and update status
          set((state) => ({
            orders: [order, ...state.orders],
          }));

          // 保存市场价格用于后续锁定余额
          const savedMarketPrice = currentMarketPrice;

          // Simulate submission delay then update status
          setTimeout(() => {
            const currentState = get();
            const orderIndex = currentState.orders.findIndex(
              o => o.clientOrderId === order.clientOrderId
            );
            
            if (orderIndex === -1) return;
            
            const currentOrder = currentState.orders[orderIndex]!;
            if (currentOrder.status !== 'pending') return;

            // Lock balance（传入市场价格用于市价单估算）
            const updatedBalances = lockBalanceForOrder(
              currentState.balances,
              currentOrder,
              savedMarketPrice
            );

            if (!updatedBalances) {
              // Reject if can't lock balance
              set((state) => ({
                orders: state.orders.map(o =>
                  o.clientOrderId === order.clientOrderId
                    ? { ...o, status: 'rejected' as OrderStatus, rejectReason: 'Insufficient balance', updatedAt: Date.now() }
                    : o
                ),
              }));
              return;
            }

            // Update to submitted -> open
            set((state) => ({
              orders: state.orders.map(o =>
                o.clientOrderId === order.clientOrderId
                  ? { ...o, status: 'open' as OrderStatus, updatedAt: Date.now() }
                  : o
              ),
              balances: updatedBalances,
            }));
          }, randomDelay());

          return order;
        },

        // Cancel an order
        cancelOrder: (clientOrderId) => {
          const state = get();
          const order = state.orders.find(o => o.clientOrderId === clientOrderId);
          
          if (!order) return false;
          
          const canCancel = ['pending', 'open', 'partial'].includes(order.status);
          if (!canCancel) return false;

          // Unlock remaining balance
          const updatedBalances = unlockBalanceForOrder(state.balances, order);

          set((state) => ({
            orders: state.orders.map(o =>
              o.clientOrderId === clientOrderId
                ? { ...o, status: 'cancelled' as OrderStatus, updatedAt: Date.now() }
                : o
            ),
            balances: updatedBalances,
          }));

          return true;
        },

        // Update order book and attempt to match orders
        updateOrderBookForMatching: (orderBook) => {
          const state = get();
          const openOrders = state.orders.filter(
            o => o.symbol === orderBook.symbol && (o.status === 'open' || o.status === 'partial')
          );

          if (openOrders.length === 0) return;

          const bestBid = orderBook.bids[0];
          const bestAsk = orderBook.asks[0];
          
          if (!bestBid || !bestAsk) return;

          const updates: { order: PaperOrder; fills: Fill[]; newStatus: OrderStatus }[] = [];

          for (const order of openOrders) {
            const matchResult = attemptMatch(order, orderBook);
            
            if (matchResult.fills.length > 0) {
              updates.push({
                order,
                fills: matchResult.fills,
                newStatus: matchResult.fullyFilled ? 'filled' : 'partial',
              });
            }
          }

          if (updates.length === 0) return;

          set((state) => {
            let newBalances = [...state.balances];
            const newPositions = new Map(state.positions);

            const newOrders = state.orders.map(o => {
              const update = updates.find(u => u.order.clientOrderId === o.clientOrderId);
              if (!update) return o;

              // Calculate new filled quantity and avg price
              const allFills = [...o.fills, ...update.fills];
              const totalFilledQty = allFills.reduce(
                (sum, f) => sum.plus(f.quantity),
                new Decimal(0)
              );
              const totalCost = allFills.reduce(
                (sum, f) => sum.plus(new Decimal(f.price).times(f.quantity)),
                new Decimal(0)
              );
              const avgPrice = totalFilledQty.gt(0) 
                ? totalCost.div(totalFilledQty).toFixed(8)
                : '0';

              // Update balances for this fill
              for (const fill of update.fills) {
                newBalances = applyFillToBalances(newBalances, o, fill);
              }

              // Update position
              const position = updatePosition(newPositions.get(o.symbol), o, update.fills);
              newPositions.set(o.symbol, position);

              return {
                ...o,
                fills: allFills,
                filledQty: totalFilledQty.toFixed(8),
                avgPrice,
                status: update.newStatus,
                updatedAt: Date.now(),
              };
            });

            return {
              orders: newOrders,
              balances: newBalances,
              positions: newPositions,
            };
          });
        },

        // Focus mode toggle
        setFocusMode: (enabled) => {
          set({ focusMode: enabled });
        },

        // Reset account
        resetAccount: () => {
          set({
            orders: [],
            positions: new Map(),
            balances: [...INITIAL_BALANCES],
          });
        },

        // Getters
        getOrder: (clientOrderId) => {
          return get().orders.find(o => o.clientOrderId === clientOrderId);
        },

        getOpenOrders: () => {
          return get().orders.filter(
            o => o.status === 'open' || o.status === 'partial' || o.status === 'pending' || o.status === 'submitted'
          );
        },

        getOrderHistory: () => {
          return get().orders.filter(
            o => o.status === 'filled' || o.status === 'cancelled' || o.status === 'rejected'
          );
        },

        getPosition: (symbol) => {
          return get().positions.get(symbol);
        },

        getBalance: (asset) => {
          return get().balances.find(b => b.asset === asset);
        },
      }),
      {
        name: 'paper-trading-storage',
        version: 1, // 版本号，数据结构变化时递增
        partialize: (state) => ({
          orders: state.orders,
          positions: Array.from(state.positions.entries()),
          balances: state.balances,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // 恢复 Map 类型
            if (Array.isArray(state.positions)) {
              state.positions = new Map(state.positions as unknown as [string, Position][]);
            } else {
              state.positions = new Map();
            }
            console.log('[TradingStore] Rehydrated from localStorage:', {
              ordersCount: state.orders?.length || 0,
              positionsCount: state.positions?.size || 0,
              balances: state.balances?.map(b => `${b.asset}: ${b.total}`),
            });
          }
        },
        // 数据迁移（版本升级时）
        migrate: (persistedState: unknown, version: number) => {
          console.log('[TradingStore] Migrating from version', version);
          return persistedState as TradingState;
        },
      }
    )
  )
);

// ===== Helper Functions =====

function randomDelay(): number {
  return SIMULATED_DELAY_MIN_MS + Math.random() * (SIMULATED_DELAY_MAX_MS - SIMULATED_DELAY_MIN_MS);
}

function lockBalanceForOrder(
  balances: AccountBalance[],
  order: PaperOrder,
  marketPrice?: string
): AccountBalance[] | null {
  const baseAsset = order.symbol.replace('USDT', '');
  const quoteAsset = 'USDT';

  if (order.side === 'buy') {
    // Lock quote asset
    let estimatedCost: Decimal;
    if (order.type === 'limit') {
      estimatedCost = new Decimal(order.price!).times(order.quantity);
    } else {
      // 市价单：使用市场价格 + 5% 缓冲
      const priceToUse = marketPrice || order.price || '0';
      estimatedCost = new Decimal(priceToUse).times(order.quantity).times(1.05);
    }

    const balance = balances.find(b => b.asset === quoteAsset);
    if (!balance || new Decimal(balance.free).lt(estimatedCost)) {
      return null;
    }

    return balances.map(b => {
      if (b.asset === quoteAsset) {
        const newFree = new Decimal(b.free).minus(estimatedCost);
        const newLocked = new Decimal(b.locked).plus(estimatedCost);
        return {
          ...b,
          free: newFree.toFixed(8),
          locked: newLocked.toFixed(8),
          total: newFree.plus(newLocked).toFixed(8), // 保持 total 一致
        };
      }
      return b;
    });
  } else {
    // Lock base asset
    const balance = balances.find(b => b.asset === baseAsset);
    if (!balance || new Decimal(balance.free).lt(order.quantity)) {
      return null;
    }

    return balances.map(b => {
      if (b.asset === baseAsset) {
        const newFree = new Decimal(b.free).minus(order.quantity);
        const newLocked = new Decimal(b.locked).plus(order.quantity);
        return {
          ...b,
          free: newFree.toFixed(8),
          locked: newLocked.toFixed(8),
          total: newFree.plus(newLocked).toFixed(8), // 保持 total 一致
        };
      }
      return b;
    });
  }
}

function unlockBalanceForOrder(
  balances: AccountBalance[],
  order: PaperOrder
): AccountBalance[] {
  const baseAsset = order.symbol.replace('USDT', '');
  const quoteAsset = 'USDT';
  const remainingQty = new Decimal(order.quantity).minus(order.filledQty);

  if (remainingQty.lte(0)) return balances;

  if (order.side === 'buy') {
    // Unlock remaining quote asset
    const lockedAmount = order.type === 'limit'
      ? new Decimal(order.price!).times(remainingQty)
      : remainingQty.times(100000);

    return balances.map(b => {
      if (b.asset === quoteAsset) {
        const newLocked = Decimal.max(new Decimal(b.locked).minus(lockedAmount), 0);
        const newFree = new Decimal(b.free).plus(new Decimal(b.locked).minus(newLocked));
        return {
          ...b,
          free: newFree.toFixed(8),
          locked: newLocked.toFixed(8),
          total: newFree.plus(newLocked).toFixed(8),
        };
      }
      return b;
    });
  } else {
    // Unlock remaining base asset
    return balances.map(b => {
      if (b.asset === baseAsset) {
        const newLocked = Decimal.max(new Decimal(b.locked).minus(remainingQty), 0);
        const newFree = new Decimal(b.free).plus(new Decimal(b.locked).minus(newLocked));
        return {
          ...b,
          free: newFree.toFixed(8),
          locked: newLocked.toFixed(8),
          total: newFree.plus(newLocked).toFixed(8),
        };
      }
      return b;
    });
  }
}

function attemptMatch(
  order: PaperOrder,
  orderBook: OrderBook
): { fills: Fill[]; fullyFilled: boolean } {
  const fills: Fill[] = [];
  let remainingQty = new Decimal(order.quantity).minus(order.filledQty);

  if (remainingQty.lte(0)) {
    return { fills: [], fullyFilled: true };
  }

  // Get levels to match against
  const levels = order.side === 'buy' ? orderBook.asks : orderBook.bids;
  
  for (const level of levels) {
    if (remainingQty.lte(0)) break;

    const levelPrice = new Decimal(level.price);
    const levelQty = new Decimal(level.quantity);

    // Check if price matches
    let canMatch = false;
    if (order.type === 'market') {
      canMatch = true;
    } else {
      // Limit order
      if (order.side === 'buy') {
        canMatch = new Decimal(order.price!).gte(levelPrice);
      } else {
        canMatch = new Decimal(order.price!).lte(levelPrice);
      }
    }

    if (!canMatch) break;

    // Calculate fill
    const fillQty = Decimal.min(remainingQty, levelQty);
    const fee = fillQty.times(levelPrice).times(FEE_RATE);

    fills.push({
      fillId: uuidv4(),
      price: level.price,
      quantity: fillQty.toFixed(8),
      fee: fee.toFixed(8),
      feeAsset: 'USDT',
      time: Date.now(),
    });

    remainingQty = remainingQty.minus(fillQty);
  }

  return {
    fills,
    fullyFilled: remainingQty.lte(0),
  };
}

function applyFillToBalances(
  balances: AccountBalance[],
  order: PaperOrder,
  fill: Fill
): AccountBalance[] {
  const baseAsset = order.symbol.replace('USDT', '');
  const quoteAsset = 'USDT';
  const fillQty = new Decimal(fill.quantity);
  const fillCost = new Decimal(fill.price).times(fillQty);
  const fee = new Decimal(fill.fee);

  return balances.map(b => {
    if (order.side === 'buy') {
      if (b.asset === baseAsset) {
        // Receive base asset
        const newFree = new Decimal(b.free).plus(fillQty);
        return {
          ...b,
          free: newFree.toFixed(8),
          total: newFree.plus(b.locked).toFixed(8),
        };
      } else if (b.asset === quoteAsset) {
        // Deduct from locked quote asset + fee
        const totalDeduct = fillCost.plus(fee);
        const newLocked = Decimal.max(new Decimal(b.locked).minus(totalDeduct), 0);
        return {
          ...b,
          locked: newLocked.toFixed(8),
          total: new Decimal(b.free).plus(newLocked).toFixed(8),
        };
      }
    } else {
      if (b.asset === baseAsset) {
        // Deduct from locked base asset
        const newLocked = Decimal.max(new Decimal(b.locked).minus(fillQty), 0);
        return {
          ...b,
          locked: newLocked.toFixed(8),
          total: new Decimal(b.free).plus(newLocked).toFixed(8),
        };
      } else if (b.asset === quoteAsset) {
        // Receive quote asset minus fee
        const received = fillCost.minus(fee);
        const newFree = new Decimal(b.free).plus(received);
        return {
          ...b,
          free: newFree.toFixed(8),
          total: newFree.plus(b.locked).toFixed(8),
        };
      }
    }
    return b;
  });
}

function updatePosition(
  currentPosition: Position | undefined,
  order: PaperOrder,
  fills: Fill[]
): Position {
  const symbol = order.symbol;
  const now = Date.now();

  if (!currentPosition) {
    currentPosition = {
      symbol,
      side: 'flat',
      quantity: '0',
      avgEntryPrice: '0',
      unrealizedPnl: '0',
      realizedPnl: '0',
      updatedAt: now,
    };
  }

  let positionQty = new Decimal(currentPosition.quantity);
  let avgEntry = new Decimal(currentPosition.avgEntryPrice);
  let realizedPnl = new Decimal(currentPosition.realizedPnl);

  for (const fill of fills) {
    const fillQty = new Decimal(fill.quantity);
    const fillPrice = new Decimal(fill.price);

    if (order.side === 'buy') {
      // Adding to long position
      const newQty = positionQty.plus(fillQty);
      if (positionQty.gt(0)) {
        // Average in
        avgEntry = positionQty.times(avgEntry).plus(fillQty.times(fillPrice)).div(newQty);
      } else {
        avgEntry = fillPrice;
      }
      positionQty = newQty;
    } else {
      // Selling
      if (positionQty.gt(0)) {
        // Realize P&L
        const pnl = fillQty.times(fillPrice.minus(avgEntry));
        realizedPnl = realizedPnl.plus(pnl);
      }
      positionQty = positionQty.minus(fillQty);
    }
  }

  return {
    symbol,
    side: positionQty.gt(0) ? 'long' : 'flat',
    quantity: Decimal.max(positionQty, 0).toFixed(8),
    avgEntryPrice: avgEntry.toFixed(8),
    unrealizedPnl: '0', // Will be calculated with current price
    realizedPnl: realizedPnl.toFixed(8),
    updatedAt: now,
  };
}

// ===== Selectors =====
export const selectOrders = (state: TradingState) => state.orders;
export const selectOpenOrders = (state: TradingState) => state.getOpenOrders();
export const selectBalances = (state: TradingState) => state.balances;
export const selectFocusMode = (state: TradingState) => state.focusMode;





