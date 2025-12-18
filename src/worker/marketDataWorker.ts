import { OrderBookManager } from './orderbook';
import type {
  WorkerMessage,
  SubscribePayload,
  OrderBookUpdatePayload,
  TradeUpdatePayload,
  ConnectionStatusPayload,
  LogPayload,
  ConnectionState,
  Trade,
  NetworkEvent,
  NetworkEventType,
  NetworkHealth,
} from '../types/market';

// ===== Configuration =====
// Binance WebSocket URLs（按优先级排序）
const BINANCE_WS_URLS = [
  'wss://stream.binance.com:9443',  // 官方主要端点
  'wss://stream.binance.com:443',   // 备用端口
];
let currentWsUrlIndex = 0;
const BINANCE_REST_URL = 'https://api.binance.com/api/v3';
const RECONNECT_BASE_DELAY_MS = 2000;  // 增加基础重连延迟
const RECONNECT_MAX_DELAY_MS = 60000;  // 增加最大重连延迟
const HEARTBEAT_INTERVAL_MS = 30000;
const STALE_CHECK_INTERVAL_MS = 500;   // 降低状态检查频率（100ms → 500ms）
const METRICS_UPDATE_INTERVAL_MS = 200; // 降低指标更新频率（100ms → 200ms）
const MAX_RECONNECTS_PER_MINUTE = 3;    // 减少每分钟最大重连次数
const QUEUE_WARNING_THRESHOLD = 100;
const QUEUE_TRADE_DOWNSAMPLE_THRESHOLD = 500;
const QUEUE_RESYNC_THRESHOLD = 1000;

// ===== State =====
let ws: WebSocket | null = null;
let orderBookManager: OrderBookManager | null = null;
let currentSymbol: string | null = null;
let connectionState: ConnectionState = 'disconnected';
let reconnectAttempts = 0;
let reconnectTimestamps: number[] = [];
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let staleCheckTimer: ReturnType<typeof setInterval> | null = null;
let metricsTimer: ReturnType<typeof setInterval> | null = null;
let lastMessageTime = 0;
let gapCount = 0;
let resyncCount = 0;
let messageQueue: unknown[] = [];
let tradeDownsampleActive = false;

// 消息速率计算：滑动窗口方式
const MESSAGE_RATE_WINDOW_MS = 1000; // 1秒窗口
let messageTimestamps: number[] = [];

// 延迟计算：滑动平均
let latencyHistory: number[] = [];
const MAX_LATENCY_SAMPLES = 20;

// ===== 网络健康监测 =====
const MAX_NETWORK_EVENTS = 50;
const SCORE_DECAY_WINDOW_MS = 5 * 60 * 1000; // 5分钟内的事件影响评分

let networkEvents: NetworkEvent[] = [];
let sessionStartTime = Date.now();
let connectedTime = 0;          // 累计连接时间
let lastConnectedStart = 0;     // 上次连接开始时间
let previousLatency = 0;        // 用于检测延迟飙升
let previousMessageRate = 0;    // 用于检测速率下降
let allLatencySamples: number[] = []; // 所有延迟样本（用于统计）
const MAX_ALL_LATENCY_SAMPLES = 500;

// 添加网络事件
function addNetworkEvent(type: NetworkEventType, details?: string, value?: number): void {
  const event: NetworkEvent = {
    timestamp: Date.now(),
    type,
    details,
    value,
  };
  
  networkEvents.unshift(event);
  if (networkEvents.length > MAX_NETWORK_EVENTS) {
    networkEvents = networkEvents.slice(0, MAX_NETWORK_EVENTS);
  }
  
  log('info', 'system', `network.${type}`, { details, value });
}

// 计算网络健康评分
function calculateNetworkHealth(): NetworkHealth {
  const now = Date.now();
  
  // 1. 计算延迟分（0-30）
  const avgLatency = latencyHistory.length > 0 
    ? latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length 
    : 0;
  
  let latencyScore = 30;
  if (avgLatency > 2000) latencyScore = 0;
  else if (avgLatency > 1000) latencyScore = 10;
  else if (avgLatency > 500) latencyScore = 20;
  else if (avgLatency > 200) latencyScore = 25;
  
  // 2. 计算稳定性分（0-30）- 基于重连和断线事件
  const recentReconnects = networkEvents.filter(
    e => (e.type === 'reconnecting' || e.type === 'disconnected') && 
         (now - e.timestamp) < SCORE_DECAY_WINDOW_MS
  ).length;
  
  let stabilityScore = 30;
  if (recentReconnects >= 5) stabilityScore = 0;
  else if (recentReconnects >= 3) stabilityScore = 10;
  else if (recentReconnects >= 2) stabilityScore = 20;
  else if (recentReconnects >= 1) stabilityScore = 25;
  
  // 3. 计算吞吐量分（0-20）- 基于消息速率
  const currentRate = messageTimestamps.length;
  let throughputScore = 20;
  if (currentRate < 0.5) throughputScore = 5;
  else if (currentRate < 1) throughputScore = 10;
  else if (currentRate < 3) throughputScore = 15;
  
  // 4. 计算可靠性分（0-20）- 基于 gap 和 resync 事件
  const recentGaps = networkEvents.filter(
    e => (e.type === 'gap_detected' || e.type === 'resync_start') && 
         (now - e.timestamp) < SCORE_DECAY_WINDOW_MS
  ).length;
  
  let reliabilityScore = 20;
  if (recentGaps >= 5) reliabilityScore = 0;
  else if (recentGaps >= 3) reliabilityScore = 8;
  else if (recentGaps >= 2) reliabilityScore = 12;
  else if (recentGaps >= 1) reliabilityScore = 16;
  
  // 总分
  const score = latencyScore + stabilityScore + throughputScore + reliabilityScore;
  
  // 计算趋势
  const recentEventsCount = networkEvents.filter(
    e => (now - e.timestamp) < 60000 && 
         ['disconnected', 'reconnecting', 'gap_detected', 'latency_spike', 'rate_drop'].includes(e.type)
  ).length;
  
  const olderEventsCount = networkEvents.filter(
    e => (now - e.timestamp) >= 60000 && (now - e.timestamp) < 120000 &&
         ['disconnected', 'reconnecting', 'gap_detected', 'latency_spike', 'rate_drop'].includes(e.type)
  ).length;
  
  let trend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (recentEventsCount > olderEventsCount + 1) trend = 'degrading';
  else if (recentEventsCount < olderEventsCount - 1) trend = 'improving';
  
  // 延迟统计
  const sortedLatencies = [...allLatencySamples].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  
  // 连接时间计算
  let totalConnectedTime = connectedTime;
  if (lastConnectedStart > 0 && connectionState === 'connected') {
    totalConnectedTime += now - lastConnectedStart;
  }
  const sessionDuration = now - sessionStartTime;
  const uptimePercent = sessionDuration > 0 ? (totalConnectedTime / sessionDuration) * 100 : 0;
  
  return {
    score,
    scoreComponents: {
      latency: latencyScore,
      stability: stabilityScore,
      throughput: throughputScore,
      reliability: reliabilityScore,
    },
    trend,
    recentEvents: networkEvents.slice(0, 20), // 只发送最近20个事件
    stats: {
      avgLatency,
      maxLatency: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1]! : 0,
      minLatency: sortedLatencies.length > 0 ? sortedLatencies[0]! : 0,
      latencyP95: sortedLatencies.length > 0 ? sortedLatencies[p95Index] ?? 0 : 0,
      uptimePercent,
      totalReconnects: reconnectAttempts,
      totalGaps: gapCount,
      sessionStartTime,
    },
  };
}

// ===== Message Handlers =====
function sendMessage<T>(type: WorkerMessage<T>['type'], payload: T): void {
  const message: WorkerMessage<T> = {
    type,
    payload,
    timestamp: performance.now(),
  };
  self.postMessage(message);
}

function log(level: LogPayload['level'], category: LogPayload['category'], event: string, data: Record<string, unknown> = {}): void {
  sendMessage<LogPayload>('LOG', { level, category, event, data });
}

function sendConnectionStatus(): void {
  const now = performance.now();
  
  // 计算消息速率：清理过期时间戳，统计窗口内消息数
  messageTimestamps = messageTimestamps.filter(t => now - t < MESSAGE_RATE_WINDOW_MS);
  const messageRate = messageTimestamps.length; // 每秒消息数
  
  // 计算平均延迟
  const avgLatency = latencyHistory.length > 0 
    ? latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length 
    : 0;
  
  // 检测延迟飙升/恢复
  if (previousLatency > 0) {
    if (avgLatency > 1000 && previousLatency <= 1000) {
      addNetworkEvent('latency_spike', `${Math.round(avgLatency)}ms`, avgLatency);
    } else if (avgLatency <= 500 && previousLatency > 1000) {
      addNetworkEvent('latency_normal', `${Math.round(avgLatency)}ms`, avgLatency);
    }
  }
  previousLatency = avgLatency;
  
  // 检测消息速率下降/恢复
  if (previousMessageRate > 0) {
    if (messageRate < 0.5 && previousMessageRate >= 1) {
      addNetworkEvent('rate_drop', `${messageRate.toFixed(1)}/s`, messageRate);
    } else if (messageRate >= 1 && previousMessageRate < 0.5) {
      addNetworkEvent('rate_normal', `${messageRate.toFixed(1)}/s`, messageRate);
    }
  }
  previousMessageRate = messageRate;
  
  // 计算网络健康评分
  const networkHealth = calculateNetworkHealth();
  
  sendMessage<ConnectionStatusPayload>('CONNECTION_STATUS', {
    state: connectionState,
    latencyMs: avgLatency,
    lastMessageTime: lastMessageTime > 0 ? Date.now() - (now - lastMessageTime) : 0,
    reconnectCount: reconnectAttempts,
    gapCount,
    resyncCount,
    messageRate,
    isStale: orderBookManager?.checkStale() ?? true,
    networkHealth,
  });
}

function sendOrderBookUpdate(): void {
  if (!orderBookManager || !orderBookManager.isInitialized) return;

  const orderBook = orderBookManager.getOrderBook();
  const metrics = orderBookManager.getMetrics();

  sendMessage<OrderBookUpdatePayload>('ORDERBOOK_UPDATE', {
    orderBook,
    metrics,
  });
}

// ===== WebSocket Management =====
async function connect(symbol: string): Promise<void> {
  // 关闭旧连接
  if (ws) {
    ws.close();
    ws = null;
  }

  // 重置所有状态（切换币种时很重要）
  currentSymbol = symbol;
  orderBookManager = new OrderBookManager(symbol);
  connectionState = 'connecting';
  reconnectAttempts = 0;
  gapCount = 0;
  resyncCount = 0;
  lastMessageTime = 0;
  messageQueue = [];
  messageTimestamps = [];
  latencyHistory = [];
  tradeDownsampleActive = false;
  
  // 重置网络健康统计（但保留事件历史）
  sessionStartTime = Date.now();
  connectedTime = 0;
  lastConnectedStart = 0;
  previousLatency = 0;
  previousMessageRate = 0;
  allLatencySamples = [];
  // 保留网络事件历史，不重置 networkEvents
  
  sendConnectionStatus();

  const streamName = `${symbol.toLowerCase()}@depth@100ms`;
  const tradeStreamName = `${symbol.toLowerCase()}@trade`;
  // Binance WebSocket 组合流格式：使用 /stream?streams= 端点
  const baseUrl = BINANCE_WS_URLS[currentWsUrlIndex % BINANCE_WS_URLS.length];
  const wsUrl = `${baseUrl}/stream?streams=${streamName}/${tradeStreamName}`;

  log('info', 'ws', 'ws.connecting', { symbol, url: wsUrl, urlIndex: currentWsUrlIndex });

  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      connectionState = 'connected';
      reconnectAttempts = 0;
      lastConnectedStart = Date.now(); // 记录连接开始时间
      addNetworkEvent('connected', symbol);
      log('info', 'ws', 'ws.connected', { symbol });
      sendConnectionStatus();
      
      // Fetch initial snapshot
      fetchSnapshot(symbol);
      
      // Start heartbeat
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      const now = performance.now();
      lastMessageTime = now;
      messageTimestamps.push(now); // 记录消息时间戳用于速率计算

      try {
        const data = JSON.parse(event.data as string);
        handleMessage(data);
      } catch (err) {
        log('error', 'ws', 'ws.parse_error', { error: String(err) });
      }
    };

    ws.onerror = (event) => {
      // WebSocket error event 不包含详细错误信息
      // 真正的错误原因会在 onclose 事件中通过 code 和 reason 提供
      log('error', 'ws', 'ws.error', { 
        type: event.type,
        message: 'WebSocket connection error (see onclose for details)',
      });
    };

    ws.onclose = (event) => {
      // 更新连接时间统计
      if (lastConnectedStart > 0) {
        connectedTime += Date.now() - lastConnectedStart;
        lastConnectedStart = 0;
      }
      
      connectionState = 'disconnected';
      addNetworkEvent('disconnected', `code: ${event.code}`, event.code);
      log('warn', 'ws', 'ws.disconnected', { 
        code: event.code, 
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean,
      });
      sendConnectionStatus();
      stopHeartbeat();
      
      // Attempt reconnect
      scheduleReconnect();
    };
  } catch (err) {
    log('error', 'ws', 'ws.connect_error', { error: String(err) });
    connectionState = 'disconnected';
    sendConnectionStatus();
    scheduleReconnect();
  }
}

async function fetchSnapshot(symbol: string): Promise<void> {
  const url = `${BINANCE_REST_URL}/depth?symbol=${symbol.toUpperCase()}&limit=1000`;
  
  log('info', 'orderbook', 'ob.snapshot_start', { symbol, url });
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const snapshot = await response.json();
    
    // 验证返回的数据结构
    if (!snapshot.lastUpdateId || !snapshot.bids || !snapshot.asks) {
      throw new Error('Invalid snapshot format');
    }
    
    orderBookManager?.applySnapshot(snapshot);
    
    addNetworkEvent('resync_complete', `lastUpdateId: ${snapshot.lastUpdateId}`);
    log('info', 'orderbook', 'ob.snapshot_complete', { 
      symbol, 
      lastUpdateId: snapshot.lastUpdateId,
      bidLevels: snapshot.bids.length,
      askLevels: snapshot.asks.length,
    });
    
    sendOrderBookUpdate();
  } catch (err) {
    log('error', 'orderbook', 'ob.snapshot_error', { 
      error: String(err),
      symbol,
      url,
    });
    
    // Retry after delay
    setTimeout(() => {
      if (currentSymbol === symbol && connectionState === 'connected') {
        fetchSnapshot(symbol);
      }
    }, 2000);
  }
}

function handleMessage(data: unknown): void {
  if (!data || typeof data !== 'object') return;

  let msg = data as Record<string, unknown>;
  
  // 处理组合流格式：{ stream: "...", data: {...} }
  if (msg['stream'] && msg['data']) {
    msg = msg['data'] as Record<string, unknown>;
  }
  
  // 计算网络延迟（使用消息的服务器时间戳）
  const serverTime = (msg['E'] || msg['T']) as number;
  if (serverTime) {
    const latency = Date.now() - serverTime;
    if (latency >= 0 && latency < 10000) { // 合理范围内
      latencyHistory.push(latency);
      if (latencyHistory.length > MAX_LATENCY_SAMPLES) {
        latencyHistory.shift();
      }
      // 保存所有样本用于统计
      allLatencySamples.push(latency);
      if (allLatencySamples.length > MAX_ALL_LATENCY_SAMPLES) {
        allLatencySamples.shift();
      }
    }
  }
  
  // Check queue pressure
  messageQueue.push(msg);
  checkBackpressure();

  if (msg['e'] === 'depthUpdate') {
    handleDepthUpdate(msg);
  } else if (msg['e'] === 'trade') {
    handleTradeUpdate(msg);
  }
}

function handleDepthUpdate(msg: Record<string, unknown>): void {
  if (!orderBookManager || !currentSymbol) return;

  // 验证消息的 symbol 是否匹配当前订阅（忽略大小写）
  const msgSymbol = (msg['s'] as string)?.toUpperCase();
  if (msgSymbol && msgSymbol !== currentSymbol.toUpperCase()) {
    // 忽略不匹配的消息（可能是旧连接的残留消息）
    return;
  }

  const result = orderBookManager.processUpdate(msg as never);
  
  if (!result.success) {
    if (result.needsResync) {
      gapCount++;
      resyncCount++;
      addNetworkEvent('gap_detected', `lastUpdateId: ${orderBookManager.lastUpdateId}`);
      log('warn', 'orderbook', 'ob.gap_detected', { 
        lastUpdateId: orderBookManager.lastUpdateId,
        messageU: msg['U'],
      });
      
      orderBookManager.markResyncStart();
      addNetworkEvent('resync_start');
      log('info', 'orderbook', 'ob.resync_start', {});
      
      if (currentSymbol) {
        fetchSnapshot(currentSymbol);
      }
    }
  }
}

function handleTradeUpdate(msg: Record<string, unknown>): void {
  if (!currentSymbol) return;

  // 验证消息的 symbol 是否匹配当前订阅（忽略大小写）
  const msgSymbol = (msg['s'] as string)?.toUpperCase();
  if (msgSymbol && msgSymbol !== currentSymbol.toUpperCase()) {
    // 忽略不匹配的消息（可能是旧连接的残留消息）
    return;
  }

  // Skip if downsampling is active (for backpressure)
  if (tradeDownsampleActive && Math.random() > 0.2) {
    return;
  }

  const trade: Trade = {
    id: String(msg['t']),
    symbol: String(msg['s']),
    price: String(msg['p']),
    quantity: String(msg['q']),
    quoteQty: String(parseFloat(msg['p'] as string) * parseFloat(msg['q'] as string)),
    time: msg['T'] as number,
    isBuyerMaker: msg['m'] as boolean,
    localReceiveTime: performance.now(),
  };

  // Update order book manager for VWAP/intensity calculation
  orderBookManager?.addTrade(
    parseFloat(trade.price),
    parseFloat(trade.quantity),
    trade.localReceiveTime
  );

  // Send trade to main thread
  sendMessage<TradeUpdatePayload>('TRADE_UPDATE', { trades: [trade] });
}

function checkBackpressure(): void {
  const queueLen = messageQueue.length;

  if (queueLen > QUEUE_RESYNC_THRESHOLD && orderBookManager) {
    log('warn', 'system', 'backpressure.resync_triggered', { queueLen });
    orderBookManager.markResyncStart();
    if (currentSymbol) {
      fetchSnapshot(currentSymbol);
    }
    messageQueue = [];
    tradeDownsampleActive = false;
  } else if (queueLen > QUEUE_TRADE_DOWNSAMPLE_THRESHOLD) {
    if (!tradeDownsampleActive) {
      log('warn', 'system', 'backpressure.trade_downsample', { queueLen });
      tradeDownsampleActive = true;
    }
  } else if (queueLen > QUEUE_WARNING_THRESHOLD) {
    log('debug', 'system', 'backpressure.warning', { queueLen });
  } else {
    tradeDownsampleActive = false;
  }

  // Clear processed messages
  if (messageQueue.length > 100) {
    messageQueue = messageQueue.slice(-50);
  }
}

function scheduleReconnect(): void {
  const now = Date.now();
  
  // Track reconnect attempts per minute
  reconnectTimestamps = reconnectTimestamps.filter(t => now - t < 60000);
  
  if (reconnectTimestamps.length >= MAX_RECONNECTS_PER_MINUTE) {
    log('warn', 'ws', 'ws.reconnect_rate_limited', { 
      attempts: reconnectTimestamps.length 
    });
    return;
  }

  reconnectAttempts++;
  reconnectTimestamps.push(now);
  
  // 尝试下一个 WebSocket URL（在多次失败后切换）
  if (reconnectAttempts % 2 === 0) {
    currentWsUrlIndex = (currentWsUrlIndex + 1) % BINANCE_WS_URLS.length;
    log('info', 'ws', 'ws.trying_alternate_url', { urlIndex: currentWsUrlIndex });
  }
  
  // Exponential backoff
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts - 1),
    RECONNECT_MAX_DELAY_MS
  );

  connectionState = 'reconnecting';
  addNetworkEvent('reconnecting', `attempt #${reconnectAttempts}`, reconnectAttempts);
  sendConnectionStatus();
  
  log('info', 'ws', 'ws.reconnect_scheduled', { delay, attempt: reconnectAttempts });

  setTimeout(() => {
    if (currentSymbol && connectionState === 'reconnecting') {
      connect(currentSymbol);
    }
  }, delay);
}

function startHeartbeat(): void {
  stopHeartbeat();
  
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Binance doesn't require ping frames from client, but we track connection health
      const timeSinceLastMessage = performance.now() - lastMessageTime;
      
      if (timeSinceLastMessage > HEARTBEAT_INTERVAL_MS * 2) {
        log('warn', 'ws', 'ws.heartbeat_timeout', { timeSinceLastMessage });
        ws.close();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Stale check timer
  staleCheckTimer = setInterval(() => {
    sendConnectionStatus();
  }, STALE_CHECK_INTERVAL_MS);

  // Metrics update timer
  metricsTimer = setInterval(() => {
    sendOrderBookUpdate();
  }, METRICS_UPDATE_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (staleCheckTimer) {
    clearInterval(staleCheckTimer);
    staleCheckTimer = null;
  }
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

function disconnect(): void {
  stopHeartbeat();
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // 重置所有状态
  currentSymbol = null;
  orderBookManager = null;
  connectionState = 'disconnected';
  reconnectAttempts = 0;
  gapCount = 0;
  resyncCount = 0;
  lastMessageTime = 0;
  messageQueue = [];
  messageTimestamps = [];
  latencyHistory = [];
  tradeDownsampleActive = false;
  
  sendConnectionStatus();
  
  log('info', 'ws', 'ws.manual_disconnect', {});
}

// ===== Worker Message Handler =====
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SUBSCRIBE': {
      const { symbol } = payload as SubscribePayload;
      connect(symbol);
      break;
    }
    case 'UNSUBSCRIBE': {
      disconnect();
      break;
    }
    default:
      log('warn', 'system', 'unknown_message_type', { type });
  }
};

// Initial status
sendConnectionStatus();
log('info', 'system', 'worker.initialized', {});

// 测试网络连接（诊断用）
async function testNetworkAccess(): Promise<void> {
  try {
    const response = await fetch(`${BINANCE_REST_URL}/ping`);
    if (response.ok) {
      log('info', 'system', 'network.binance_api_ok', {});
    } else {
      log('warn', 'system', 'network.binance_api_error', { status: response.status });
    }
  } catch (err) {
    log('error', 'system', 'network.binance_api_unreachable', { error: String(err) });
  }
}

// 启动时测试网络
testNetworkAccess();

