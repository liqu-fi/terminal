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
// WebSocket 可直连，不需要代理
const BINANCE_WS_URLS = [
  'wss://stream.binance.com:9443',  // 官方主要端点
  'wss://stream.binance.com:443',   // 备用端口
];
let currentWsUrlIndex = 0;
// REST API 使用代理路径避免 CORS（在 worker 中使用相对路径）
// Note: import.meta.env in workers requires specific Vite configuration or 
// passing the base URL during worker initialization. For now we use the default.
const BINANCE_REST_URL = '/binance-api/api/v3';
const RECONNECT_BASE_DELAY_MS = 2000;  // 基础重连延迟
const RECONNECT_MAX_DELAY_MS = 30000;  // 最大重连延迟（缩短）
const HEARTBEAT_INTERVAL_MS = 15000;   // 心跳检测间隔 15 秒
const HEARTBEAT_TIMEOUT_MS = 20000;    // 心跳超时 20 秒（匹配 stale 阈值）
const STALE_CHECK_INTERVAL_MS = 1000;  // 状态检查频率
const STALE_RECONNECT_THRESHOLD_MS = 15000; // 15秒无更新主动触发重连
const METRICS_UPDATE_INTERVAL_MS = 250; // 指标更新频率
const MAX_RECONNECTS_PER_MINUTE = 5;    // 每分钟最大重连次数（放宽）
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
let tradeBatchTimer: ReturnType<typeof setInterval> | null = null; // 成交批处理定时器
let reconnectMonitorTimer: ReturnType<typeof setInterval> | null = null; // 重连监控定时器
let lastMessageTime = 0;
let gapCount = 0;
let resyncCount = 0;
let messageQueue: unknown[] = [];
let tradeBatch: Trade[] = []; // 成交批处理队列
let tradeDownsampleActive = false;
let isIntentionalClose = false; // 标记是否为主动关闭（切换币种/取消订阅）
let connectionId = 0; // 连接 ID，用于处理竞态条件
let pendingConnectTimer: ReturnType<typeof setTimeout> | null = null; // 延迟连接定时器
let lastReconnectAttemptTime = 0; // 上次重连尝试时间

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
  
  // 计算最新消息时间戳（转换为 Date.now() 格式）
  const now = performance.now();
  const lastMsgTime = lastMessageTime > 0 ? Date.now() - (now - lastMessageTime) : 0;

  sendMessage<OrderBookUpdatePayload>('ORDERBOOK_UPDATE', {
    orderBook,
    metrics,
    lastMessageTime: lastMsgTime,
  });
}

// ===== WebSocket Management =====
async function connect(symbol: string): Promise<void> {
  // 取消任何待处理的连接请求（防抖，避免 React StrictMode 双重挂载问题）
  if (pendingConnectTimer) {
    clearTimeout(pendingConnectTimer);
    pendingConnectTimer = null;
  }
  
  // 关闭旧连接（标记为主动关闭，避免记录错误）
  if (ws) {
    isIntentionalClose = true;
    ws.close();
    ws = null;
  }
  
  // 递增连接 ID，使之前的回调失效
  connectionId++;
  const thisConnectionId = connectionId;

  // 重置所有状态（切换币种时很重要）
  currentSymbol = symbol;
  orderBookManager = new OrderBookManager(symbol);
  connectionState = 'connecting';
  reconnectAttempts = 0;
  gapCount = 0;
  resyncCount = 0;
  lastMessageTime = 0;
  lastReconnectAttemptTime = 0;
  messageQueue = [];
  messageTimestamps = [];
  latencyHistory = [];
  tradeDownsampleActive = false;
  
  // 启动重连监控器
  startReconnectMonitor();
  
  // 重置网络健康统计（但保留事件历史）
  sessionStartTime = Date.now();
  connectedTime = 0;
  lastConnectedStart = 0;
  previousLatency = 0;
  previousMessageRate = 0;
  allLatencySamples = [];
  // 保留网络事件历史，不重置 networkEvents
  
  sendConnectionStatus();

  // 延迟创建 WebSocket，避免 React StrictMode 双重挂载导致的竞态条件
  // 如果在延迟期间 connect 被再次调用，定时器会被取消
  pendingConnectTimer = setTimeout(() => {
    pendingConnectTimer = null;
    
    // 再次检查连接 ID，确保这次连接请求仍然有效
    if (thisConnectionId !== connectionId) {
      return;
    }
    
    const streamName = `${symbol.toLowerCase()}@depth@100ms`;
    const tradeStreamName = `${symbol.toLowerCase()}@trade`;
    const tickerStreamName = `${symbol.toLowerCase()}@miniTicker`;
    // Binance WebSocket 组合流格式：使用 /stream?streams= 端点
    const baseUrl = BINANCE_WS_URLS[currentWsUrlIndex % BINANCE_WS_URLS.length];
    const wsUrl = `${baseUrl}/stream?streams=${streamName}/${tradeStreamName}/${tickerStreamName}`;

    log('info', 'ws', 'ws.connecting', { symbol, url: wsUrl, urlIndex: currentWsUrlIndex });

    try {
      isIntentionalClose = false; // 重置主动关闭标志
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        // 检查连接 ID，如果已被新连接取代则忽略
        if (thisConnectionId !== connectionId) {
          return;
        }
        
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
        // 检查连接 ID，如果已被新连接取代则忽略
        if (thisConnectionId !== connectionId) {
          return;
        }
        
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
        // 检查连接 ID，如果已被新连接取代则忽略
        if (thisConnectionId !== connectionId) {
          return;
        }
        
        // 如果是主动关闭导致的错误，不记录为错误
        if (isIntentionalClose) {
          log('info', 'ws', 'ws.closed_intentionally', { type: event.type });
          return;
        }
        
        // WebSocket error event 不包含详细错误信息
        // 真正的错误原因会在 onclose 事件中通过 code 和 reason 提供
        log('error', 'ws', 'ws.error', { 
          type: event.type,
          message: 'WebSocket connection error (see onclose for details)',
        });
      };

      ws.onclose = (event) => {
        // 检查连接 ID，如果已被新连接取代则忽略（不重连）
        if (thisConnectionId !== connectionId) {
          return;
        }
        
        // 更新连接时间统计
        if (lastConnectedStart > 0) {
          connectedTime += Date.now() - lastConnectedStart;
          lastConnectedStart = 0;
        }
        
        connectionState = 'disconnected';
        
        // 如果是主动关闭，不记录警告也不触发重连
        if (isIntentionalClose) {
          log('info', 'ws', 'ws.closed_intentionally', { code: event.code });
          sendConnectionStatus();
          stopHeartbeat();
          return;
        }
        
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
  }, 50); // 50ms 延迟足以处理 StrictMode 的快速卸载-挂载周期
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
  } else if (msg['e'] === '24hrMiniTicker') {
    handleMiniTickerUpdate(msg);
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

  // Add to batch instead of sending immediately
  tradeBatch.push(trade);
  
  // If batch gets too large, send immediately
  if (tradeBatch.length >= 50) {
    sendTradeBatch();
  }
}

function handleMiniTickerUpdate(msg: Record<string, unknown>): void {
  if (!orderBookManager || !currentSymbol) return;

  // 验证消息的 symbol 是否匹配当前订阅（忽略大小写）
  const msgSymbol = (msg['s'] as string)?.toUpperCase();
  if (msgSymbol && msgSymbol !== currentSymbol.toUpperCase()) {
    // 忽略不匹配的消息
    return;
  }

  // Update 24h ticker data in order book manager
  // Binance miniTicker format: { h: high, l: low, v: volume, ... }
  // Note: miniTicker doesn't include price change, so we calculate it from open price
  const openPrice = parseFloat(msg['o'] as string);
  const closePrice = parseFloat(msg['c'] as string);
  const priceChange = closePrice - openPrice;
  const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0;

  orderBookManager.updateTicker24h({
    h: String(msg['h']),  // 24h high
    l: String(msg['l']),  // 24h low
    v: String(msg['v']),  // 24h volume (base asset)
    p: priceChange.toFixed(8),
    P: priceChangePercent.toFixed(2),
  });
}

function sendTradeBatch(): void {
  if (tradeBatch.length === 0) return;
  
  sendMessage<TradeUpdatePayload>('TRADE_UPDATE', { trades: tradeBatch });
  tradeBatch = [];
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
  lastReconnectAttemptTime = now;
  
  // Track reconnect attempts per minute
  reconnectTimestamps = reconnectTimestamps.filter(t => now - t < 60000);
  
  if (reconnectTimestamps.length >= MAX_RECONNECTS_PER_MINUTE) {
    log('warn', 'ws', 'ws.reconnect_rate_limited', { 
      attempts: reconnectTimestamps.length,
      maxPerMinute: MAX_RECONNECTS_PER_MINUTE
    });
    // 即使被限流，也保持 reconnecting 状态而不是立即切换到 stale
    // 这样 UI 会显示"重连中"而不是"已过期"
    if (connectionState !== 'reconnecting') {
      connectionState = 'reconnecting';
      sendConnectionStatus();
    }
    // 在限流期间，延迟后重试（延迟时间根据限流窗口动态计算）
    const oldestTimestamp = reconnectTimestamps[0] || now;
    const waitTime = Math.max(60000 - (now - oldestTimestamp) + 1000, 5000); // 等到限流窗口过期 + 1秒
    log('info', 'ws', 'ws.waiting_for_rate_limit', { waitTime });
    setTimeout(() => {
      if (currentSymbol && (connectionState === 'reconnecting' || connectionState === 'disconnected')) {
        scheduleReconnect();
      }
    }, waitTime);
    return;
  }

  reconnectAttempts++;
  reconnectTimestamps.push(now);
  
  // 尝试下一个 WebSocket URL（在多次失败后切换）
  if (reconnectAttempts % 3 === 0) {
    currentWsUrlIndex = (currentWsUrlIndex + 1) % BINANCE_WS_URLS.length;
    log('info', 'ws', 'ws.trying_alternate_url', { urlIndex: currentWsUrlIndex });
  }
  
  // Exponential backoff with jitter to avoid thundering herd
  const baseDelay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(1.3, reconnectAttempts - 1), // 使用 1.3 倍增，更快重连
    RECONNECT_MAX_DELAY_MS
  );
  // 添加随机抖动 (±20%)
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  const delay = Math.round(baseDelay + jitter);

  connectionState = 'reconnecting';
  addNetworkEvent('reconnecting', `attempt #${reconnectAttempts}`, reconnectAttempts);
  sendConnectionStatus();
  
  log('info', 'ws', 'ws.reconnect_scheduled', { delay, attempt: reconnectAttempts });

  setTimeout(() => {
    if (currentSymbol && (connectionState === 'reconnecting' || connectionState === 'disconnected')) {
      reconnectWithRetainedData(currentSymbol);
    }
  }, delay);
}

// 重连时保留数据的连接函数
async function reconnectWithRetainedData(symbol: string): Promise<void> {
  // 保留现有的 orderBookManager 和数据，不重置
  // 只是重新建立 WebSocket 连接
  
  // 取消任何待处理的连接请求
  if (pendingConnectTimer) {
    clearTimeout(pendingConnectTimer);
    pendingConnectTimer = null;
  }
  
  // 关闭旧连接
  if (ws) {
    isIntentionalClose = true;
    ws.close();
    ws = null;
  }
  
  // 递增连接 ID
  connectionId++;
  const thisConnectionId = connectionId;
  
  // 保留 symbol 和 orderBookManager（不重置数据）
  currentSymbol = symbol;
  connectionState = 'reconnecting'; // 保持 reconnecting 状态
  
  // 不重置这些统计（保持连续性）：
  // - gapCount, resyncCount（累计值）
  // - networkEvents（事件历史）
  
  // 重置连接相关的临时状态
  lastMessageTime = 0;
  messageQueue = [];
  messageTimestamps = [];
  latencyHistory = [];
  tradeDownsampleActive = false;
  
  sendConnectionStatus();
  
  // 延迟创建 WebSocket
  pendingConnectTimer = setTimeout(() => {
    pendingConnectTimer = null;
    
    if (thisConnectionId !== connectionId) {
      return;
    }
    
    const streamName = `${symbol.toLowerCase()}@depth@100ms`;
    const tradeStreamName = `${symbol.toLowerCase()}@trade`;
    const tickerStreamName = `${symbol.toLowerCase()}@miniTicker`;
    const baseUrl = BINANCE_WS_URLS[currentWsUrlIndex % BINANCE_WS_URLS.length];
    const wsUrl = `${baseUrl}/stream?streams=${streamName}/${tradeStreamName}/${tickerStreamName}`;
    
    log('info', 'ws', 'ws.reconnecting', { symbol, url: wsUrl, urlIndex: currentWsUrlIndex });
    
    try {
      isIntentionalClose = false;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        if (thisConnectionId !== connectionId) return;
        
        connectionState = 'connected';
        reconnectAttempts = 0;
        lastConnectedStart = Date.now();
        addNetworkEvent('connected', `reconnected: ${symbol}`);
        log('info', 'ws', 'ws.reconnected', { symbol });
        sendConnectionStatus();
        
        // 如果 orderBookManager 已经有数据，不需要重新获取 snapshot
        // 只有在检测到 gap 时才会触发 resync
        if (!orderBookManager || !orderBookManager.isInitialized) {
          // 需要创建新的 manager 或获取 snapshot
          if (!orderBookManager) {
            orderBookManager = new OrderBookManager(symbol);
          }
          fetchSnapshot(symbol);
        }
        
        startHeartbeat();
      };
      
      ws.onmessage = (event) => {
        if (thisConnectionId !== connectionId) return;
        
        const now = performance.now();
        lastMessageTime = now;
        messageTimestamps.push(now);
        
        try {
          const data = JSON.parse(event.data as string);
          handleMessage(data);
        } catch (err) {
          log('error', 'ws', 'ws.parse_error', { error: String(err) });
        }
      };
      
      ws.onerror = (event) => {
        if (thisConnectionId !== connectionId) return;
        if (isIntentionalClose) {
          log('info', 'ws', 'ws.closed_intentionally', { type: event.type });
          return;
        }
        log('error', 'ws', 'ws.error', { 
          type: event.type,
          message: 'WebSocket connection error',
        });
      };
      
      ws.onclose = (event) => {
        if (thisConnectionId !== connectionId) return;
        
        if (lastConnectedStart > 0) {
          connectedTime += Date.now() - lastConnectedStart;
          lastConnectedStart = 0;
        }
        
        connectionState = 'disconnected';
        
        if (isIntentionalClose) {
          log('info', 'ws', 'ws.closed_intentionally', { code: event.code });
          sendConnectionStatus();
          stopHeartbeat();
          return;
        }
        
        addNetworkEvent('disconnected', `code: ${event.code}`, event.code);
        log('warn', 'ws', 'ws.disconnected', { 
          code: event.code, 
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean,
        });
        sendConnectionStatus();
        stopHeartbeat();
        
        scheduleReconnect();
      };
    } catch (err) {
      log('error', 'ws', 'ws.reconnect_error', { error: String(err) });
      connectionState = 'disconnected';
      sendConnectionStatus();
      scheduleReconnect();
    }
  }, 50);
}

function startHeartbeat(): void {
  stopHeartbeat();
  
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Binance doesn't require ping frames from client, but we track connection health
      const timeSinceLastMessage = performance.now() - lastMessageTime;
      
      // 如果超过心跳超时时间没收到消息，关闭连接触发重连
      if (lastMessageTime > 0 && timeSinceLastMessage > HEARTBEAT_TIMEOUT_MS) {
        log('warn', 'ws', 'ws.heartbeat_timeout', { 
          timeSinceLastMessage: Math.round(timeSinceLastMessage),
          threshold: HEARTBEAT_TIMEOUT_MS 
        });
        ws.close();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Stale check timer - 检测数据过期并主动触发重连
  staleCheckTimer = setInterval(() => {
    sendConnectionStatus();
    
    // 主动检测 stale 状态并触发重连
    if (lastMessageTime > 0 && connectionState === 'connected') {
      const timeSinceLastMessage = performance.now() - lastMessageTime;
      if (timeSinceLastMessage > STALE_RECONNECT_THRESHOLD_MS) {
        log('warn', 'ws', 'ws.stale_detected', { 
          timeSinceLastMessage: Math.round(timeSinceLastMessage),
          threshold: STALE_RECONNECT_THRESHOLD_MS 
        });
        // 主动关闭并触发重连
        if (ws) {
          ws.close();
        }
      }
    }
  }, STALE_CHECK_INTERVAL_MS);

  // Metrics update timer
  metricsTimer = setInterval(() => {
    sendOrderBookUpdate();
  }, METRICS_UPDATE_INTERVAL_MS);

  // Trade batch timer
  tradeBatchTimer = setInterval(() => {
    sendTradeBatch();
  }, 100); // Send trade batch every 100ms
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
  if (tradeBatchTimer) {
    clearInterval(tradeBatchTimer);
    tradeBatchTimer = null;
  }
}

// 启动重连监控定时器（在连接断开期间持续运行）
function startReconnectMonitor(): void {
  stopReconnectMonitor();
  
  reconnectMonitorTimer = setInterval(() => {
    // 持续发送状态更新（即使断开连接）
    sendConnectionStatus();
    
    // 如果处于断开或重连状态，检查是否需要触发重连
    if (currentSymbol && (connectionState === 'disconnected' || connectionState === 'reconnecting')) {
      const now = Date.now();
      const timeSinceLastReconnect = now - lastReconnectAttemptTime;
      
      // 如果距离上次重连尝试超过 10 秒且没有活跃的 WebSocket，主动触发重连
      if (timeSinceLastReconnect > 10000 && (!ws || ws.readyState === WebSocket.CLOSED)) {
        log('info', 'ws', 'ws.reconnect_monitor_trigger', { 
          timeSinceLastReconnect,
          connectionState 
        });
        scheduleReconnect();
      }
    }
  }, 2000); // 每 2 秒检查一次
}

function stopReconnectMonitor(): void {
  if (reconnectMonitorTimer) {
    clearInterval(reconnectMonitorTimer);
    reconnectMonitorTimer = null;
  }
}

function disconnect(): void {
  // 取消待处理的连接请求
  if (pendingConnectTimer) {
    clearTimeout(pendingConnectTimer);
    pendingConnectTimer = null;
  }
  
  stopHeartbeat();
  stopReconnectMonitor(); // 停止重连监控
  
  if (ws) {
    isIntentionalClose = true; // 标记为主动关闭
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
  lastReconnectAttemptTime = 0;
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

// 移除启动时的网络测试，减少 API 请求

