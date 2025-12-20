import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type {
  Trigger,
  TriggerStatus,
  ExecutionLog,
  AutomationErrorCode,
} from '../types/automation';
import { useTradingStore } from './tradingStore';
import { useMarketStore } from './marketStore';
import { useWalletStore } from './walletStore';

// ===== Constants =====
// Execution configuration (reserved for future use)
// const EXECUTION_CONFIG = {
//   maxConcurrent: 3,
//   maxQueueSize: 10,
//   executionTimeoutMs: 5000,
//   retryCount: 0,
// };

// ===== Store State =====
interface AutomationState {
  triggers: Trigger[];
  executionLogs: ExecutionLog[];
  isEngineRunning: boolean;
  
  // Actions - CRUD
  addTrigger: (params: Omit<Trigger, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'triggerCount' | 'successCount' | 'failCount'> & { id?: string }) => Trigger;
  updateTriggerStatus: (id: string, status: TriggerStatus, reason?: string) => void;
  removeTrigger: (id: string) => void;
  pauseTrigger: (id: string) => void;
  resumeTrigger: (id: string) => void;
  
  // Actions - Engine
  startEngine: () => void;
  stopEngine: () => void;
  processTriggers: (symbol: string, priceState: { current: Decimal; previous: Decimal; source: 'last' | 'bid' | 'ask' | 'mid' }) => void;
  
  // Actions - Logs
  addExecutionLog: (log: Omit<ExecutionLog, 'id'>) => void;
  clearLogs: () => void;
  
  // Getters
  getTriggersBySymbol: (symbol: string) => Trigger[];
  getTrigger: (id: string) => Trigger | undefined;
}

// Custom storage to handle potential serialization issues if any
const customStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.error('[AutomationStore] Failed to parse storage:', e);
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch (e) {
      console.error('[AutomationStore] Failed to save storage:', e);
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

// Helper for crossing detection
function evaluateTrigger(trigger: Trigger, current: Decimal, previous: Decimal): boolean {
  const threshold = new Decimal(trigger.condition.threshold);
  const { operator, direction } = trigger.condition;

  if (direction === 'up' && operator === 'gte') {
    return previous.lt(threshold) && current.gte(threshold);
  }
  if (direction === 'down' && operator === 'lte') {
    return previous.gt(threshold) && current.lte(threshold);
  }
  return false;
}

// Track previous prices per source for each symbol to detect crossings
const lastPrices: Record<string, Record<string, Decimal>> = {};

export const useAutomationStore = create<AutomationState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        triggers: [],
        executionLogs: [],
        isEngineRunning: false,

        addTrigger: (params) => {
          const now = Date.now();
          const { id, ...rest } = params;
          const trigger: Trigger = {
            ...rest,
            id: id || uuidv4(),
            status: 'armed',
            createdAt: now,
            updatedAt: now,
            triggerCount: 0,
            successCount: 0,
            failCount: 0,
          };

          set((state) => ({
            triggers: [trigger, ...state.triggers],
          }));

          return trigger;
        },

        updateTriggerStatus: (id, status, reason) => {
          set((state) => ({
            triggers: state.triggers.map((t) =>
              t.id === id ? { ...t, status, statusReason: reason, updatedAt: Date.now() } : t
            ),
          }));
        },

        removeTrigger: (id) => {
          set((state) => ({
            triggers: state.triggers.filter((t) => t.id !== id),
          }));
        },

        pauseTrigger: (id) => {
          get().updateTriggerStatus(id, 'paused');
        },

        resumeTrigger: (id) => {
          get().updateTriggerStatus(id, 'armed');
        },

        startEngine: () => {
          if (get().isEngineRunning) return;
          set({ isEngineRunning: true });
          console.log('[AutomationStore] Engine started');
        },

        stopEngine: () => {
          set({ isEngineRunning: false });
          console.log('[AutomationStore] Engine stopped');
        },

        processTriggers: (symbol, priceState) => {
          const { current, previous, source } = priceState;
          const state = get();
          if (!state.isEngineRunning) return;

          const armedTriggers = state.triggers.filter(
            (t) =>
              t.symbol === symbol &&
              t.condition.priceSource === source &&
              (t.status === 'armed' || t.status === 'blocked')
          );

          const now = Date.now();
          const dataConfidence = useMarketStore.getState().dataConfidence;

          for (const trigger of armedTriggers) {
            // Check crossing
            const isSatisfied = evaluateTrigger(trigger, current, previous);
            if (!isSatisfied) continue;

            // Check debounce
            if (trigger.lastTriggeredAt && now - trigger.lastTriggeredAt < trigger.condition.debounceMs) {
              continue;
            }

            // Check cooldown for repeat triggers
            if (trigger.repeat && trigger.lastTriggeredAt && now - trigger.lastTriggeredAt < trigger.condition.cooldownMs) {
              continue;
            }

            // Handle Data Confidence
            const isLive = dataConfidence.level === 'live';
            const isDegradedAllowed = dataConfidence.level === 'degraded' && trigger.allowDegraded;
            const canExecute = isLive || isDegradedAllowed;
            
            if (!canExecute) {
              if (trigger.status !== 'blocked') {
                state.updateTriggerStatus(trigger.id, 'blocked', `Data confidence: ${dataConfidence.level}`);
              }
              
              state.addExecutionLog({
                triggerId: trigger.id,
                firedAt: now,
                observedPrice: current.toFixed(8),
                confidenceLevel: dataConfidence.level,
                confidenceReason: dataConfidence.reason,
                result: 'blocked',
                errorCode: 'DATA_NOT_RELIABLE',
                errorMessage: 'Execution blocked due to low data confidence',
                executionLatencyMs: Date.now() - now,
              });
              continue;
            }

            // If degraded but allowed, apply 2s delay as per plan
            const executionDelay = isDegradedAllowed ? 2000 : 0;

            // Execute action
            const executionStartTime = Date.now();
            setTimeout(() => {
              executeAction(trigger, current)
                .then((result) => {
                  const endTime = Date.now();
                  const latency = endTime - executionStartTime;

                if (result.success) {
                  state.addExecutionLog({
                    triggerId: trigger.id,
                    firedAt: now,
                    observedPrice: current.toFixed(8),
                    confidenceLevel: dataConfidence.level,
                    confidenceReason: dataConfidence.reason,
                    result: 'success',
                    orderId: result.orderId,
                    executionLatencyMs: latency,
                  });

                  set((state) => {
                    const newTriggers = state.triggers.map((t) =>
                      t.id === trigger.id
                        ? {
                            ...t,
                            status: t.repeat ? 'armed' : ('completed' as TriggerStatus),
                            triggerCount: t.triggerCount + 1,
                            successCount: t.successCount + 1,
                            lastTriggeredAt: now,
                            updatedAt: Date.now(),
                          }
                        : t
                    );

                    // OCO Cancellation logic
                    if (trigger.linkedTriggerId) {
                      return {
                        triggers: newTriggers.map((t) =>
                          t.id === trigger.linkedTriggerId
                            ? { ...t, status: 'cancelled' as TriggerStatus, statusReason: 'OCO cancelled by linked trigger', updatedAt: Date.now() }
                            : t
                        ),
                      };
                    }

                    return { triggers: newTriggers };
                  });
                } else {
                  state.addExecutionLog({
                    triggerId: trigger.id,
                    firedAt: now,
                    observedPrice: current.toFixed(8),
                    confidenceLevel: dataConfidence.level,
                    confidenceReason: dataConfidence.reason,
                    result: 'failed',
                    errorCode: result.errorCode as AutomationErrorCode,
                    errorMessage: result.errorMessage,
                    executionLatencyMs: latency,
                  });

                  set((state) => ({
                    triggers: state.triggers.map((t) =>
                      t.id === trigger.id
                        ? {
                            ...t,
                            status: t.repeat ? 'armed' : ('failed' as TriggerStatus),
                            triggerCount: t.triggerCount + 1,
                            failCount: t.failCount + 1,
                            lastTriggeredAt: now,
                            updatedAt: Date.now(),
                          }
                        : t
                    ),
                  }));
                }
              })
              .catch((err) => {
                console.error('[AutomationStore] Execution error:', err);
                state.addExecutionLog({
                  triggerId: trigger.id,
                  firedAt: now,
                  observedPrice: current.toFixed(8),
                  confidenceLevel: dataConfidence.level,
                  confidenceReason: dataConfidence.reason,
                  result: 'failed',
                  errorCode: 'UNKNOWN_ERROR',
                  errorMessage: err.message,
                  executionLatencyMs: Date.now() - now,
                });
              });
            }, executionDelay);
          }
        },

        addExecutionLog: (log) => {
          set((state) => ({
            executionLogs: [{ ...log, id: uuidv4() }, ...state.executionLogs].slice(0, 1000),
          }));
        },

        clearLogs: () => {
          set({ executionLogs: [] });
        },

        getTriggersBySymbol: (symbol) => {
          return get().triggers.filter((t) => t.symbol === symbol);
        },

        getTrigger: (id) => {
          return get().triggers.find((t) => t.id === id);
        },
      }),
      {
        name: 'paper-automation-storage',
        storage: customStorage as any,
        partialize: (state) => ({
          triggers: state.triggers,
          executionLogs: state.executionLogs,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.startEngine();
          }
        },
      }
    )
  )
);

// ===== Execution Logic =====

async function executeAction(
  trigger: Trigger,
  observedPrice: Decimal
): Promise<{ success: boolean; orderId?: string; errorCode?: string; errorMessage?: string }> {
  const { action, symbol } = trigger;
  const tradingStore = useTradingStore.getState();
  const walletStore = useWalletStore.getState();

  if (action.type === 'alert') {
    // For MVP, alerts are just execution logs with success
    return { success: true };
  }

  if (action.type === 'order') {
    // 1. Calculate quantity
    let quantityValue = new Decimal(action.quantityValue);
    let finalQuantity: string;

    if (action.quantityMode === 'percent') {
      const assetToCheck = action.side === 'buy' ? 'USDT' : symbol.replace('USDT', '');
      const balance = walletStore.getBalance(assetToCheck);
      if (!balance) return { success: false, errorCode: 'INSUFFICIENT_BALANCE', errorMessage: 'Asset not found in wallet' };
      
      const available = new Decimal(balance.available);
      if (action.side === 'buy') {
        // Buy using percentage of USDT available
        const priceToUse = action.orderType === 'limit' ? new Decimal(action.limitPrice!) : observedPrice;
        // Add 5% buffer for market buy to ensure execution
        const costPerUnit = priceToUse.times(action.orderType === 'market' ? 1.05 : 1);
        finalQuantity = available.times(quantityValue).div(100).div(costPerUnit).toFixed(8);
      } else {
        // Sell percentage of base asset
        finalQuantity = available.times(quantityValue).div(100).toFixed(8);
      }
    } else {
      finalQuantity = quantityValue.toFixed(8);
    }

    // 2. Double check balance before placing order
    const canTrade = await validateBalanceForAction(trigger, finalQuantity, observedPrice);
    if (!canTrade) {
      return { success: false, errorCode: 'INSUFFICIENT_BALANCE', errorMessage: 'Insufficient balance at trigger time' };
    }

    // 3. Place order
    const order = tradingStore.createOrder({
      symbol,
      side: action.side!,
      type: action.orderType!,
      price: action.limitPrice,
      quantity: finalQuantity,
    }, observedPrice.toFixed(8));

    if (order) {
      return { success: true, orderId: order.clientOrderId };
    } else {
      return { success: false, errorCode: 'ORDER_REJECTED', errorMessage: 'Trading engine rejected order' };
    }
  }

  return { success: false, errorCode: 'UNKNOWN_ERROR', errorMessage: 'Invalid action type' };
}

async function validateBalanceForAction(trigger: Trigger, quantity: string, observedPrice: Decimal): Promise<boolean> {
  const { action, symbol } = trigger;
  const walletStore = useWalletStore.getState();
  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = 'USDT';

  if (action.side === 'buy') {
    const price = action.orderType === 'limit' ? new Decimal(action.limitPrice!) : observedPrice;
    const requiredQuote = price.times(quantity).times(action.orderType === 'market' ? 1.05 : 1);
    const balance = walletStore.getBalance(quoteAsset);
    return !!balance && new Decimal(balance.available).gte(requiredQuote);
  } else {
    const balance = walletStore.getBalance(baseAsset);
    return !!balance && new Decimal(balance.available).gte(quantity);
  }
}

// ===== Market Data Subscription =====

// Subscription to marketStore to drive the engine
useMarketStore.subscribe(
  (state) => ({
    metrics: state.metrics,
    orderBook: state.orderBook,
    recentTrades: state.recentTrades,
  }),
  (data) => {
    const automationStore = useAutomationStore.getState();
    if (!automationStore.isEngineRunning) return;

    const symbol = useMarketStore.getState().orderBook?.symbol;
    if (!symbol) return;

    // Process Mid Price
    if (data.metrics?.mid) {
      const current = new Decimal(data.metrics.mid);
      updateAndProcess(symbol, 'mid', current);
    }

    // Process Bid/Ask
    if (data.orderBook?.bids?.[0]) {
      const current = new Decimal(data.orderBook.bids[0].price);
      updateAndProcess(symbol, 'bid', current);
    }
    if (data.orderBook?.asks?.[0]) {
      const current = new Decimal(data.orderBook.asks[0].price);
      updateAndProcess(symbol, 'ask', current);
    }

    // Process Last Price
    if (data.recentTrades?.[0]) {
      const current = new Decimal(data.recentTrades[0].price);
      updateAndProcess(symbol, 'last', current);
    }
  }
);

function updateAndProcess(symbol: string, source: 'last' | 'bid' | 'ask' | 'mid', current: Decimal) {
  if (!lastPrices[symbol]) lastPrices[symbol] = {};
  
  const previous = lastPrices[symbol][source];
  if (previous && !previous.equals(current)) {
    useAutomationStore.getState().processTriggers(symbol, {
      current,
      previous,
      source,
    });
  }
  
  lastPrices[symbol][source] = current;
}


// Subscription to dataConfidence to update trigger statuses (armed vs blocked)
useMarketStore.subscribe(
  (state) => state.dataConfidence,
  (confidence) => {
    const automationStore = useAutomationStore.getState();
    const { triggers, updateTriggerStatus } = automationStore;
    
    triggers.forEach(trigger => {
      if (trigger.status === 'armed' && confidence.level !== 'live' && !(confidence.level === 'degraded' && trigger.allowDegraded)) {
        updateTriggerStatus(trigger.id, 'blocked', `Data confidence: ${confidence.level}`);
      } else if (trigger.status === 'blocked' && (confidence.level === 'live' || (confidence.level === 'degraded' && trigger.allowDegraded))) {
        updateTriggerStatus(trigger.id, 'armed');
      }
    });
  }
);

// Subscription to positions to cancel TP/SL when position is closed
useTradingStore.subscribe(
  (state) => state.positions,
  (positions) => {
    const automationStore = useAutomationStore.getState();
    const { triggers, updateTriggerStatus } = automationStore;
    
    triggers.forEach(trigger => {
      if ((trigger.type === 'takeProfit' || trigger.type === 'stopLoss') && trigger.status === 'armed') {
        let position = undefined;
        if (positions instanceof Map) {
          position = positions.get(trigger.symbol);
        } else if (typeof positions === 'object' && positions !== null) {
          position = (positions as any)[trigger.symbol];
        }

        if (!position || new Decimal(position.quantity).lte(0)) {
          updateTriggerStatus(trigger.id, 'cancelled', 'Position closed');
        }
      }
    });
  }
);
