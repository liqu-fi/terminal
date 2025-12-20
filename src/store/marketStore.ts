import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  OrderBook,
  DerivedMetrics,
  Trade,
  ConnectionStatus,
  DataConfidence,
  DataConfidenceLevel,
  NetworkHealth,
  WorkerMessage,
  OrderBookUpdatePayload,
  TradeUpdatePayload,
  ConnectionStatusPayload,
  LogPayload,
} from '../types/market';
import { CONFIDENCE_THRESHOLDS } from '../types/market';
import { useI18n } from '../i18n';
import { formatMessage } from '../i18n';

// ===== Store State =====
interface MarketState {
  // Connection
  connectionStatus: ConnectionStatus;
  
  // Data Confidence - 诚实系统的核心
  dataConfidence: DataConfidence;
  
  // Network Health - 网络质量评分
  networkHealth: NetworkHealth | null;
  
  // Market Data
  orderBook: OrderBook | null;
  metrics: DerivedMetrics | null;
  recentTrades: Trade[];
  
  // Logs
  logs: LogPayload[];
  
  // Worker reference
  worker: Worker | null;
  
  // Actions
  subscribe: (symbol: string) => void;
  unsubscribe: () => void;
  clearLogs: () => void;
}

const MAX_RECENT_TRADES = 50;
const MAX_LOGS = 200;

// 状态切换滞后配置（防止频繁切换）
const LEVEL_UPGRADE_THRESHOLD = 2;   // 恢复到更好状态需要连续 2 次
const LEVEL_DOWNGRADE_THRESHOLD = 5; // 降级到更差状态需要连续 5 次（增加容忍度）
const STALE_THRESHOLD = 8;           // 进入 stale 状态需要连续 8 次（最严格保护）
let consecutiveLevelCounts: Record<DataConfidenceLevel, number> = {
  live: 0,
  degraded: 0,
  resyncing: 0,
  stale: 0,
};
// 上次状态变化时间，用于防止抖动
let lastLevelChangeTime = 0;
const MIN_LEVEL_CHANGE_INTERVAL_MS = 3000; // 状态切换最小间隔 3 秒

const initialConnectionStatus: ConnectionStatus = {
  state: 'disconnected',
  latencyMs: 0,
  lastMessageTime: 0,
  reconnectCount: 0,
  gapCount: 0,
  resyncCount: 0,
  messageRate: 0,
  isStale: true,
};

const getInitialDataConfidence = (): DataConfidence => {
  const t = useI18n.getState().t;
  return {
    level: 'stale',
    reason: t.dataConfidence.waitingConnection,
    canTrade: false,
    canTrustMetrics: false,
    lastLiveTime: 0,
    degradedSince: 0,
    details: {
      wsConnected: false,
      sequenceContinuous: false,
      latencyOk: false,
      updateFrequencyOk: false,
      queueHealthy: true,
    },
  };
};

// 计算数据可信度（带滞后缓冲，防止频繁切换）
function calculateConfidence(
  connectionStatus: ConnectionStatus,
  orderBook: OrderBook | null,
  prevConfidence: DataConfidence
): DataConfidence {
  const now = Date.now();
  const { state, latencyMs, lastMessageTime, messageRate, gapCount } = connectionStatus;
  const t = useI18n.getState().t;
  
  // 检查各项条件
  const wsConnected = state === 'connected';
  const sequenceContinuous = orderBook ? !orderBook.isStale : false;
  const timeSinceUpdate = lastMessageTime > 0 ? now - lastMessageTime : 0;
  const hasReceivedData = lastMessageTime > 0;
  
  const details = {
    wsConnected,
    sequenceContinuous,
    latencyOk: latencyMs < CONFIDENCE_THRESHOLDS.DEGRADED_LATENCY,
    updateFrequencyOk: !hasReceivedData || timeSinceUpdate < CONFIDENCE_THRESHOLDS.DEGRADED_UPDATE_INTERVAL,
    queueHealthy: true,
  };
  
  // 确定原始可信度级别（不考虑滞后）
  let rawLevel: DataConfidenceLevel;
  let reason: string;
  
  if (state === 'connecting') {
    rawLevel = 'resyncing';
    reason = t.dataConfidence.establishingConnection;
  } else if (state === 'reconnecting') {
    // 重连中显示 resyncing 而不是 stale，给用户更好的体验
    rawLevel = 'resyncing';
    reason = t.dataConfidence.rebuildingData;
  } else if (state === 'disconnected') {
    // 只有真正断开且没有重连尝试时才显示 stale
    rawLevel = 'stale';
    reason = t.dataConfidence.connectionDisconnected;
  } else if (orderBook?.isStale) {
    rawLevel = 'resyncing';
    reason = t.dataConfidence.rebuildingData;
  } else if (!hasReceivedData) {
    rawLevel = 'resyncing';
    reason = t.dataConfidence.waitingData;
  } else if (timeSinceUpdate > CONFIDENCE_THRESHOLDS.DEGRADED_UPDATE_INTERVAL || latencyMs > CONFIDENCE_THRESHOLDS.DEGRADED_LATENCY) {
    // 数据过期但连接还在，显示 degraded 而不是 stale（重连会自动触发）
    rawLevel = 'degraded';
    reason = timeSinceUpdate > CONFIDENCE_THRESHOLDS.DEGRADED_UPDATE_INTERVAL ? t.dataConfidence.dataExpired : t.dataConfidence.highLatency;
  } else if (timeSinceUpdate > CONFIDENCE_THRESHOLDS.LIVE_UPDATE_INTERVAL || latencyMs > CONFIDENCE_THRESHOLDS.LIVE_LATENCY || messageRate < CONFIDENCE_THRESHOLDS.DEGRADED_MESSAGE_RATE) {
    rawLevel = 'degraded';
    if (latencyMs > CONFIDENCE_THRESHOLDS.LIVE_LATENCY) {
      reason = formatMessage(t.dataConfidence.highLatencyWithValue, { latency: Math.round(latencyMs) });
    } else if (timeSinceUpdate > CONFIDENCE_THRESHOLDS.LIVE_UPDATE_INTERVAL) {
      reason = t.dataConfidence.longUpdateInterval;
    } else {
      reason = formatMessage(t.dataConfidence.lowMessageRate, { rate: messageRate.toFixed(1) });
    }
  } else if (gapCount > 0 && now - prevConfidence.lastLiveTime < 10000) {
    rawLevel = 'degraded';
    reason = formatMessage(t.dataConfidence.recentGaps, { count: gapCount });
  } else {
    rawLevel = 'live';
    reason = t.dataConfidence.dataSyncing;
  }
  
  // === 滞后缓冲逻辑（防止网络抖动导致的频繁切换） ===
  // 更新计数器
  for (const l of ['live', 'degraded', 'resyncing', 'stale'] as DataConfidenceLevel[]) {
    if (l === rawLevel) {
      consecutiveLevelCounts[l]++;
    } else {
      consecutiveLevelCounts[l] = 0;
    }
  }
  
  // 判断是否应该切换状态
  let level = prevConfidence.level;
  const timeSinceLevelChange = now - lastLevelChangeTime;
  
  // 确定切换阈值
  // 快速恢复：从差状态到好状态只需 LEVEL_UPGRADE_THRESHOLD 次
  // 慢速降级：从好状态到差状态需要更多次数
  const isUpgrade = (rawLevel === 'live' && level !== 'live') ||
                    (rawLevel === 'degraded' && (level === 'stale' || level === 'resyncing'));
  const isToStale = rawLevel === 'stale' && level !== 'stale';
  
  let threshold: number;
  if (isUpgrade) {
    threshold = LEVEL_UPGRADE_THRESHOLD;
  } else if (isToStale) {
    threshold = STALE_THRESHOLD; // 进入 stale 需要最严格的确认
  } else {
    threshold = LEVEL_DOWNGRADE_THRESHOLD;
  }
  
  // 额外的时间保护：状态切换需要满足最小间隔
  const canChangeLevel = timeSinceLevelChange >= MIN_LEVEL_CHANGE_INTERVAL_MS || isUpgrade;
  
  if (consecutiveLevelCounts[rawLevel] >= threshold && canChangeLevel) {
    if (level !== rawLevel) {
      lastLevelChangeTime = now;
    }
    level = rawLevel;
  }
  
  // 特殊情况：断开连接需要满足更宽松的条件才切换到 stale
  // 短暂的断开不立即显示 stale（给重连一个机会）
  if (state === 'disconnected' && consecutiveLevelCounts.stale >= 3) {
    level = 'stale';
    lastLevelChangeTime = now;
  }
  
  // 可用性判断
  const canTrade = level === 'live';
  const canTrustMetrics = level === 'live' || level === 'degraded';
  
  // 时间戳更新
  const lastLiveTime = level === 'live' ? now : prevConfidence.lastLiveTime;
  const degradedSince = level !== 'live' && prevConfidence.level === 'live' 
    ? now 
    : (level !== 'live' ? prevConfidence.degradedSince : 0);
  
  return {
    level,
    reason,
    canTrade,
    canTrustMetrics,
    lastLiveTime,
    degradedSince,
    details,
  };
}

export const useMarketStore = create<MarketState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    connectionStatus: initialConnectionStatus,
    dataConfidence: getInitialDataConfidence(),
    networkHealth: null,
    orderBook: null,
    metrics: null,
    recentTrades: [],
    logs: [],
    worker: null,

    // Subscribe to a symbol
    subscribe: (symbol: string) => {
      let { worker } = get();

      // Create worker if not exists
      if (!worker) {
        try {
          worker = new Worker(
            new URL('../worker/marketDataWorker.ts', import.meta.url),
            { type: 'module' }
          );

          worker.onerror = (error) => {
            console.error('Worker error:', error);
            const t = useI18n.getState().t;
            set({
              connectionStatus: {
                ...get().connectionStatus,
                state: 'disconnected',
              },
              dataConfidence: {
                ...get().dataConfidence,
                level: 'stale',
                reason: t.dataConfidence.workerInitFailed,
              },
            });
          };

          worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, payload } = event.data;
            const state = get();

            switch (type) {
              case 'ORDERBOOK_UPDATE': {
                const data = payload as OrderBookUpdatePayload;
                // 使用 payload 中的 lastMessageTime 更新 connectionStatus，确保 timeSinceUpdate 计算准确
                const updatedConnectionStatus = {
                  ...state.connectionStatus,
                  lastMessageTime: data.lastMessageTime,
                };
                const newConfidence = calculateConfidence(
                  updatedConnectionStatus,
                  data.orderBook,
                  state.dataConfidence
                );
                set({
                  orderBook: data.orderBook,
                  metrics: data.metrics,
                  connectionStatus: updatedConnectionStatus,
                  dataConfidence: newConfidence,
                });
                break;
              }
              case 'TRADE_UPDATE': {
                const data = payload as TradeUpdatePayload;
                set((state) => ({
                  recentTrades: [...data.trades, ...state.recentTrades].slice(0, MAX_RECENT_TRADES),
                }));
                break;
              }
              case 'CONNECTION_STATUS': {
                const data = payload as ConnectionStatusPayload;
                const currentState = get();
                const newConfidence = calculateConfidence(
                  data,
                  currentState.orderBook,
                  currentState.dataConfidence
                );
                set({ 
                  connectionStatus: data,
                  dataConfidence: newConfidence,
                  networkHealth: data.networkHealth || null,
                });
                break;
              }
              case 'LOG': {
                const data = payload as LogPayload;
                set((state) => ({
                  logs: [data, ...state.logs].slice(0, MAX_LOGS),
                }));
                break;
              }
            }
          };

          set({ worker });
        } catch (err) {
          console.error('Failed to create Worker:', err);
          const t = useI18n.getState().t;
          set({
            connectionStatus: {
              ...initialConnectionStatus,
              state: 'disconnected',
            },
            dataConfidence: {
              ...getInitialDataConfidence(),
              level: 'stale',
              reason: t.dataConfidence.workerCreateFailed,
            },
          });
          return;
        }
      }

      // Send subscribe message
      worker.postMessage({
        type: 'SUBSCRIBE',
        payload: { symbol, streams: ['depth', 'trade'] },
        timestamp: performance.now(),
      });

      // 重置滞后计数器
      consecutiveLevelCounts = {
        live: 0,
        degraded: 0,
        resyncing: 0,
        stale: 0,
      };

      // Reset state
      const t = useI18n.getState().t;
      set({
        orderBook: null,
        metrics: null,
        recentTrades: [],
        connectionStatus: {
          ...initialConnectionStatus,
          state: 'connecting',
        },
        dataConfidence: {
          ...getInitialDataConfidence(),
          level: 'stale',
          reason: t.dataConfidence.establishingConnection,
        },
      });
    },

    // Unsubscribe
    unsubscribe: () => {
      const { worker } = get();
      
      if (worker) {
        worker.postMessage({
          type: 'UNSUBSCRIBE',
          payload: {},
          timestamp: performance.now(),
        });
      }

      set({
        orderBook: null,
        metrics: null,
        recentTrades: [],
        connectionStatus: initialConnectionStatus,
        dataConfidence: getInitialDataConfidence(),
        networkHealth: null,
      });
    },

    // Clear logs
    clearLogs: () => {
      set({ logs: [] });
    },
  }))
);

// ===== Selectors =====
export const selectConnectionStatus = (state: MarketState) => state.connectionStatus;
export const selectDataConfidence = (state: MarketState) => state.dataConfidence;
export const selectNetworkHealth = (state: MarketState) => state.networkHealth;
export const selectOrderBook = (state: MarketState) => state.orderBook;
export const selectMetrics = (state: MarketState) => state.metrics;
export const selectRecentTrades = (state: MarketState) => state.recentTrades;
export const selectLogs = (state: MarketState) => state.logs;
export const selectBestBid = (state: MarketState) => state.orderBook?.bids[0];
export const selectBestAsk = (state: MarketState) => state.orderBook?.asks[0];
export const selectCanTrade = (state: MarketState) => state.dataConfidence.canTrade;
export const selectCanTrustMetrics = (state: MarketState) => state.dataConfidence.canTrustMetrics;

// 订阅 i18n 变化，当语言切换时更新 dataConfidence.reason
useI18n.subscribe(
  () => {
    // 语言切换时，重新计算 confidence 以更新 reason
    const marketState = useMarketStore.getState();
    if (marketState.connectionStatus && marketState.orderBook !== undefined) {
      const newConfidence = calculateConfidence(
        marketState.connectionStatus,
        marketState.orderBook,
        marketState.dataConfidence
      );
      useMarketStore.setState({ dataConfidence: newConfidence });
    } else {
      // 如果还没有连接，更新初始状态的 reason
      useMarketStore.setState({ dataConfidence: getInitialDataConfidence() });
    }
  }
);

