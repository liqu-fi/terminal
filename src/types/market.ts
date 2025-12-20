// ===== 市场数据类型 =====

export interface Trade {
  id: string;              // 成交ID（交易所提供）
  symbol: string;          // 交易对，如 "BTCUSDT"
  price: string;           // 成交价格（string 精度）
  quantity: string;        // 成交数量
  quoteQty: string;        // 成交金额 = price * quantity
  time: number;            // 成交时间（ms timestamp）
  isBuyerMaker: boolean;   // true=卖单成交，false=买单成交
  localReceiveTime: number; // 本地接收时间
}

export interface OrderBookLevel {
  price: string;           // 价格档位
  quantity: string;        // 该档位累计数量
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];  // 买盘，价格降序
  asks: OrderBookLevel[];  // 卖盘，价格升序
  lastUpdateId: number;    // 最后更新ID（用于增量合并校验）
  localUpdateTime: number; // 本地更新时间
  isStale: boolean;        // 是否过期（>500ms 未更新）
  depth: number;           // 当前档位深度
}

export interface Candle {
  symbol: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;          // 成交量（base asset）
  quoteVolume: string;     // 成交额（quote asset）
  trades: number;          // 成交笔数
  isClosed: boolean;       // 该K线是否已收盘
}

// ===== 派生指标 =====

export interface DerivedMetrics {
  mid: string;              // 中间价
  spread: string;           // 买卖价差（绝对值）
  spreadBps: number;        // 价差（基点）
  bidAskImbalance: number;  // 买卖压力指标，-1~+1
  microVolatility: number;  // 过去60s波动率
  tradeIntensity: number;   // 过去10s成交笔数
  vwap60s: string;          // 60s VWAP
  liquidityScore: number;   // 流动性评分 0-100
  slippageEst: string;      // 滑点预估
  lastUpdateTime: number;   // 最后更新时间
  bidDepthVolume: string;   // 买盘累计深度
  askDepthVolume: string;   // 卖盘累计深度
  // 24小时统计数据
  high24h: string;          // 24小时最高价
  low24h: string;           // 24小时最低价
  vol24h: string;           // 24小时成交量（base asset）
  priceChange24h: string;   // 24小时价格变化
  priceChangePercent24h: string; // 24小时价格变化百分比
}

// ===== 连接状态 =====

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface ConnectionStatus {
  state: ConnectionState;
  latencyMs: number;        // 延迟毫秒
  lastMessageTime: number;  // 最后消息时间
  reconnectCount: number;   // 重连次数
  gapCount: number;         // gap 次数
  resyncCount: number;      // resync 次数
  messageRate: number;      // 消息速率（msg/s）
  isStale: boolean;         // 数据是否过期
}

// ===== 网络健康评分 =====

export type NetworkEventType = 
  | 'connected'           // 连接成功
  | 'disconnected'        // 断开连接
  | 'reconnecting'        // 开始重连
  | 'latency_spike'       // 延迟飙升
  | 'latency_normal'      // 延迟恢复正常
  | 'gap_detected'        // 序列间隙
  | 'resync_start'        // 开始重建
  | 'resync_complete'     // 重建完成
  | 'rate_drop'           // 消息速率下降
  | 'rate_normal';        // 消息速率恢复

export interface NetworkEvent {
  timestamp: number;
  type: NetworkEventType;
  details?: string;
  value?: number;         // 相关数值（如延迟ms）
}

export interface NetworkHealth {
  score: number;            // 0-100 综合评分
  scoreComponents: {
    latency: number;        // 延迟分（0-30）
    stability: number;      // 稳定性分（0-30）
    throughput: number;     // 吞吐量分（0-20）
    reliability: number;    // 可靠性分（0-20）
  };
  trend: 'improving' | 'stable' | 'degrading';  // 趋势
  recentEvents: NetworkEvent[];  // 最近事件（保留最近50个）
  
  // 统计数据
  stats: {
    avgLatency: number;       // 平均延迟
    maxLatency: number;       // 最大延迟
    minLatency: number;       // 最小延迟
    latencyP95: number;       // P95 延迟
    uptimePercent: number;    // 连接时间占比
    totalReconnects: number;  // 总重连次数
    totalGaps: number;        // 总 gap 次数
    sessionStartTime: number; // 会话开始时间
  };
}

// ===== 数据可信度模型（Data Confidence Model）=====
// 这是"诚实系统"的核心产品能力

export type DataConfidenceLevel = 'live' | 'degraded' | 'resyncing' | 'stale';

export interface DataConfidence {
  level: DataConfidenceLevel;
  
  // 触发条件的详细信息
  reason: string;           // 当前状态的原因描述
  
  // 数据可用性
  canTrade: boolean;        // 是否建议交易
  canTrustMetrics: boolean; // 指标是否可信
  
  // 时间戳
  lastLiveTime: number;     // 最后 Live 状态时间
  degradedSince: number;    // 开始降级时间（0表示未降级）
  
  // 详细指标
  details: {
    wsConnected: boolean;
    sequenceContinuous: boolean;
    latencyOk: boolean;     // < 500ms
    updateFrequencyOk: boolean; // 有持续更新
    queueHealthy: boolean;  // 消息队列不积压
  };
}

// 可信度状态的触发阈值
export const CONFIDENCE_THRESHOLDS = {
  LIVE_UPDATE_INTERVAL: 5000,      // ms，更新间隔 < 5s 为 LIVE
  DEGRADED_UPDATE_INTERVAL: 12000, // ms，更新间隔 5-12s 为 DEGRADED（在重连触发前）
  LIVE_LATENCY: 1000,              // ms，延迟 < 1000ms 为 LIVE
  DEGRADED_LATENCY: 2500,          // ms，延迟 1-2.5s 为 DEGRADED
  DEGRADED_MESSAGE_RATE: 0.5,      // msg/s，低于此值进入 Degraded
  QUEUE_WARNING: 100,              // 队列长度警告阈值
} as const;

// ===== Worker 消息类型 =====

export type WorkerMessageType =
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'ORDERBOOK_UPDATE'
  | 'TRADE_UPDATE'
  | 'METRICS_UPDATE'
  | 'CONNECTION_STATUS'
  | 'ERROR'
  | 'LOG';

export interface WorkerMessage<T = unknown> {
  type: WorkerMessageType;
  payload: T;
  timestamp: number;
}

export interface SubscribePayload {
  symbol: string;
  streams: ('depth' | 'trade')[];
}

export interface OrderBookUpdatePayload {
  orderBook: OrderBook;
  metrics: DerivedMetrics;
  lastMessageTime: number; // 最新消息时间戳（Date.now() 格式），用于准确计算更新间隔
}

export interface TradeUpdatePayload {
  trades: Trade[];
}

export interface ConnectionStatusPayload extends ConnectionStatus {
  networkHealth?: NetworkHealth;
}

export interface LogPayload {
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'ws' | 'orderbook' | 'order' | 'system';
  event: string;
  data: Record<string, unknown>;
}

