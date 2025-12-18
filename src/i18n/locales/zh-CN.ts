export const zhCN = {
  // 通用
  common: {
    loading: '加载中...',
    error: '错误',
    success: '成功',
    cancel: '取消',
    confirm: '确认',
    close: '关闭',
    save: '保存',
    reset: '重置',
    copy: '复制',
    copied: '已复制',
    more: '更多',
    less: '收起',
    all: '全部',
    none: '无',
    yes: '是',
    no: '否',
    info: '信息',
  },

  // 顶部栏
  header: {
    title: '交易平台',
    subtitle: 'Trading Platform',
    paperTrading: '',
    disclaimer: '',
  },

  // 交易对选择
  symbolSelector: {
    label: '交易对',
    placeholder: '交易对 (例如: BTCUSDT)',
    popular: '热门',
    all: '全部',
  },

  // 主题切换
  theme: {
    light: '浅色模式',
    dark: '深色模式',
    toggle: '切换主题',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
  },

  // 语言切换
  language: {
    label: '语言',
    zh: '中文',
    en: 'English',
  },

  // 数据可信度条 - 诚实系统核心
  dataConfidence: {
    title: '数据可信度',
    // 四种可信度状态
    live: '实时',
    liveDesc: '数据实时同步，可正常交易',
    degraded: '降级',
    degradedDesc: '数据可能滞后，建议谨慎操作',
    resyncing: '重建中',
    resyncingDesc: '正在重建 Order Book，数据可能不完整',
    stale: '已过期',
    staleDesc: '数据已过期，暂停交易操作',
    metricsUncertain: '指标可能不准确',
    // 连接状态
    connected: '已连接',
    connecting: '连接中',
    disconnected: '已断开',
    reconnecting: '重连中',
    // 指标
    latency: '延迟',
    lastUpdate: '最后更新',
    messageRate: '消息速率',
    messagesPerSecond: '条/秒',
    gapCount: '序列间隙',
    resyncCount: '重建次数',
    queueLength: '队列长度',
    reconnectCount: '重连次数',
    // 状态标签
    healthy: '健康',
    warning: '警告',
    critical: '异常',
    // 详细面板
    systemStatus: '系统状态',
    wsConnection: 'WebSocket 连接',
    sequenceCheck: '序列校验',
    latencyCheck: '延迟检测',
    updateFrequency: '更新频率',
    queueHealth: '队列健康',
    passed: '正常',
    failed: '异常',
    cannotTrade: '数据同步中',
    lastLiveTime: '最后实时时间',
    degradedDuration: '降级持续时间',
    // 诊断抽屉
    diagnostics: '诊断',
    provider: '数据源',
    reconnect: '重新连接',
    forceResync: '强制重建',
    truthTimeline: '事件时间线',
    sessionStats: '会话统计',
    avgLatency: '平均延迟',
    // 状态原因消息
    waitingConnection: '等待连接...',
    connectionDisconnected: '连接已断开',
    establishingConnection: '正在建立连接...',
    rebuildingData: '正在重建数据...',
    waitingData: '等待数据...',
    dataExpired: '数据已过期',
    highLatency: '延迟过高',
    highLatencyWithValue: '延迟较高（{latency}ms）',
    longUpdateInterval: '更新间隔较长',
    lowMessageRate: '消息速率偏低（{rate}/s）',
    recentGaps: '近期发生 {count} 次序列间隙',
    dataSyncing: '数据实时同步中',
    workerInitFailed: 'Worker 初始化失败',
    workerCreateFailed: 'Worker 创建失败',
  },

  // 网络健康评分
  networkHealth: {
    title: '网络质量',
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',
    improving: '改善中',
    stable: '稳定',
    degrading: '下降中',
    // 分项评分
    latencyScore: '延迟',
    stabilityScore: '稳定性',
    throughputScore: '吞吐量',
    reliabilityScore: '可靠性',
    // 统计
    sessionDuration: '会话时长',
    uptime: '在线率',
    avgLatency: '平均延迟',
    p95Latency: 'P95延迟',
    minLatency: '最小',
    maxLatency: '最大',
    noEvents: '暂无事件',
    // 事件类型
    events: {
      connected: '连接成功',
      disconnected: '连接断开',
      reconnecting: '正在重连',
      latencySpike: '延迟飙升',
      latencyNormal: '延迟恢复',
      gapDetected: '序列间隙',
      resyncStart: '开始重建',
      resyncComplete: '重建完成',
      rateDrop: '速率下降',
      rateNormal: '速率恢复',
    },
  },

  // 盘口
  orderBook: {
    title: '盘口',
    price: '价格',
    amount: '数量',
    total: '累计',
    bids: '买盘',
    asks: '卖盘',
    spread: '价差',
    spreadBps: '基点',
    depthLevels: '档位深度',
    midPrice: '中间价',
    imbalance: '买卖失衡',
    imbalanceBuy: '买方强势',
    imbalanceSell: '卖方强势',
    imbalanceNeutral: '中性',
  },

  // 最近成交
  recentTrades: {
    title: '最近成交',
    time: '时间',
    price: '价格',
    amount: '数量',
    side: '方向',
    buy: '买入',
    sell: '卖出',
    noTrades: '暂无成交记录',
  },

  // 市场指标
  metrics: {
    title: '市场指标',
    midPrice: '中间价',
    spread: '价差',
    imbalance: '买卖失衡',
    volatility: '短期波动',
    tradeIntensity: '成交强度',
    vwap: '成交量加权均价',
    liquidityScore: '流动性评分',
    slippageEst: '滑点估计',
    
    // 指标解释
    midPriceDesc: '买一与卖一的中间价格',
    spreadDesc: '买卖价差（绝对值/基点）',
    imbalanceDesc: '买卖盘力量对比 (-1到1)',
    volatilityDesc: '近60秒价格波动率',
    tradeIntensityDesc: '近10秒成交笔数',
    vwapDesc: '成交量加权平均价格',
    liquidityScoreDesc: '0-100流动性评分',
    slippageEstDesc: '0.1单位市价单预估滑点',
  },

  // 下单
  orderEntry: {
    title: '下单',
    buy: '买入',
    sell: '卖出',
    market: '市价',
    limit: '限价',
    price: '价格',
    amount: '数量',
    total: '总额',
    available: '可用',
    max: '最大',
    percent25: '25%',
    percent50: '50%',
    percent75: '75%',
    percent100: '100%',
    placeOrder: '下单',
    placeBuyOrder: '买入 {symbol}',
    placeSellOrder: '卖出 {symbol}',
    confirmOrder: '确认下单',
    orderPlaced: '订单已提交',
    orderFailed: '下单失败',
    insufficientBalance: '余额不足',
    invalidPrice: '请输入有效价格',
    invalidAmount: '请输入有效数量',
    minAmount: '最小数量: {min}',
    focusMode: '聚焦模式',
    focusModeHint: '价格更新不会打断输入',
    // 快捷填充
    bid1: '买一',
    ask1: '卖一',
    mid: '中间价',
    // 步进控制
    stepUp: '增加',
    stepDown: '减少',
    // 二次确认
    confirmDegraded: '数据可能延迟，确认提交？',
    // 预估信息
    estimatedPrice: '预估成交价',
    slippage: '滑点',
    fee: '手续费',
    pricePlaceholder: '0.00',
    amountPlaceholder: '0.00',
    // 快捷操作
    allInBuy: '满仓买入',
    allInSell: '全部卖出',
    // 满仓确认弹窗
    confirmAllInBuyTitle: '确认满仓买入',
    confirmAllInSellTitle: '确认全部卖出',
    confirmAllInBuyMessage: '将使用全部可用资金买入',
    confirmAllInSellMessage: '将卖出全部持有的币',
    confirmAllInBuy: '确认买入',
    confirmAllInSell: '确认卖出',
  },

  // 挂单列表
  openOrders: {
    title: '当前挂单',
    noOrders: '暂无挂单',
    orderId: '订单ID',
    symbol: '交易对',
    side: '方向',
    type: '类型',
    price: '价格',
    amount: '数量',
    filled: '已成交',
    remaining: '剩余',
    status: '状态',
    time: '时间',
    cancel: '撤单',
    cancelAll: '全部撤单',
    cancelConfirm: '确认撤销此订单？',
    cancelAllConfirm: '确认撤销全部挂单？',
    cancelled: '已撤销',
    cancelFailed: '撤单失败',
  },

  // 订单状态
  orderStatus: {
    pending: '待处理',
    submitted: '已提交',
    open: '挂单中',
    partial: '部分成交',
    filled: '完全成交',
    cancelled: '已撤销',
    rejected: '已拒绝',
    expired: '已过期',
  },

  // 持仓
  positions: {
    title: '当前持仓',
    noPositions: '暂无持仓',
    symbol: '交易对',
    side: '方向',
    amount: '数量',
    avgPrice: '均价',
    currentPrice: '现价',
    unrealizedPnL: '未实现盈亏',
    realizedPnL: '已实现盈亏',
    long: '多头',
    flat: '空仓',
    close: '平仓',
    closeAll: '全部平仓',
    closePosition: '市价平仓',
    marketClose: '市价全平',
    closeOrderSubmitted: '平仓订单已提交',
    switchingSymbol: '正在切换交易对...',
    noMarketData: '无市场数据，请稍后重试',
    // 平仓确认弹窗
    confirmCloseTitle: '确认平仓',
    confirmCloseMessage: '确定要市价卖出全部持仓吗？',
    confirmClose: '确认平仓',
  },

  // 账户
  account: {
    title: '账户',
    balance: '余额',
    available: '可用',
    locked: '冻结',
    totalValue: '总资产',
    unrealizedPnL: '未实现盈亏',
    realizedPnL: '已实现盈亏',
    marginUsed: '已用保证金',
    marginAvailable: '可用保证金',
  },

  // 风险丝带
  riskRibbon: {
    title: '风险概览',
    positionRatio: '仓位占比',
    unrealizedPnL: '未实现盈亏',
    volatilityRisk: '波动风险',
    low: '低',
    medium: '中',
    high: '高',
    veryHigh: '极高',
  },

  // 深度图
  depthChart: {
    title: '深度图',
    bids: '买盘深度',
    asks: '卖盘深度',
    price: '价格',
    cumulative: '累计量',
    logScale: '对数刻度',
    linearScale: '线性刻度',
  },

  // 欢迎引导
  welcome: {
    title: '欢迎使用交易平台',
    subtitle: '专业的数字资产交易终端',
    step1Title: '实时行情',
    step1Desc: '连接实时市场数据，获取最新价格和深度信息',
    step2Title: '交易执行',
    step2Desc: '支持限价和市价订单，快速执行交易策略',
    step3Title: '数据分析',
    step3Desc: '深入了解市场微观结构，观察盘口变化趋势',
    getStarted: '开始使用',
    dontShowAgain: '不再显示',
    disclaimer: '',
    stepLabel: '步骤 {n}',
  },

  // 操作提示
  tips: {
    orderBookClick: '点击盘口价格可快速填入下单价格',
    tradeClick: '点击成交记录可查看详情',
    shortcut: '快捷键',
    shortcuts: {
      buy: 'B - 切换到买入',
      sell: 'S - 切换到卖出',
      market: 'M - 市价单',
      limit: 'L - 限价单',
      cancel: 'Esc - 取消/关闭',
      submit: 'Enter - 确认下单',
      theme: 'T - 切换主题',
      toggle: '显示/隐藏快捷键',
      hint: '按 ? 键随时查看',
    },
  },

  // Toast 消息
  toast: {
    orderSubmitted: '订单已提交',
    orderFilled: '订单已完全成交',
    orderPartialFilled: '订单部分成交 ({filled}/{total})',
    orderCancelled: '订单已撤销',
    orderRejected: '订单被拒绝: {reason}',
    connectionRestored: '连接已恢复',
    connectionLost: '连接已断开，正在重连...',
    dataStale: '数据可能已过期',
    copied: '已复制到剪贴板',
    eventsSuppressed: '条事件已抑制',
  },

  // 错误消息
  errors: {
    networkError: '网络错误，请检查连接',
    timeout: '请求超时',
    invalidInput: '输入无效',
    serverError: '服务器错误',
    unknownError: '未知错误',
  },

  // 时间格式
  time: {
    justNow: '刚刚',
    secondsAgo: '{n}秒前',
    minutesAgo: '{n}分钟前',
    hoursAgo: '{n}小时前',
    today: '今天',
    yesterday: '昨天',
  },

  // 数字格式
  numbers: {
    thousand: '千',
    million: '百万',
    billion: '十亿',
    trillion: '万亿',
  },

  // 自选列表
  watchlist: {
    title: '自选列表',
    searchPlaceholder: '搜索交易对...',
    showAll: '显示全部',
    showFavorites: '只显示收藏',
    noResults: '未找到匹配的交易对',
    empty: '自选列表为空',
    symbols: '个交易对',
    addToFavorites: '添加收藏',
    removeFromFavorites: '取消收藏',
    pin: '置顶',
    unpin: '取消置顶',
    toggleFavorite: '切换收藏',
  },

  // 可观测性
  observability: {
    title: '可观测性',
    metrics: '指标',
    logs: '日志',
    systemHealth: '系统健康',
    sessionStats: '会话统计',
    wsConnection: 'WebSocket 连接',
    sequenceCheck: '序列校验',
    latencyCheck: '延迟检测',
    updateFrequency: '更新频率',
    latency: '延迟',
    messageRate: '消息速率',
    gapCount: '序列间隙',
    resyncCount: '重建次数',
    reconnectCount: '重连次数',
    confidence: '可信度',
    all: '全部',
    warnPlus: '警告+',
    error: '错误',
    clear: '清空',
    noLogs: '暂无日志记录',
  },

  // 声音
  sound: {
    enable: '开启声音',
    disable: '关闭声音',
    toggle: '切换声音',
  },

  // 导航
  nav: {
    trade: '交易',
    markets: '市场',
    wallet: '钱包',
    orders: '订单',
  },

  // 市场页
  markets: {
    title: '市场',
    comingSoon: '市场页面即将推出...',
    tableView: '表格视图',
    gridView: '网格视图',
    searchPlaceholder: '搜索交易对...',
    symbol: '交易对',
    price: '价格',
    change24h: '24h涨跌',
    volume24h: '24h成交量',
    chart: '图表',
    actions: '操作',
  },

  // 钱包页
  wallet: {
    title: '钱包',
    comingSoon: '钱包页面即将推出...',
  },

  // 订单页
  orders: {
    title: '订单',
    comingSoon: '订单页面即将推出...',
    // 标签页
    openTab: '活动订单',
    historyTab: '历史订单',
    tradesTab: '成交记录',
    // 统计
    openOrders: '活动订单',
    filledOrders: '已成交',
    totalTrades: '成交笔数',
    totalVolume: '成交金额',
    // 订单状态
    status: {
      pending: '待提交',
      submitted: '已提交',
      open: '挂单中',
      partial: '部分成交',
      filled: '已成交',
      cancelled: '已取消',
      rejected: '已拒绝',
    },
    // 订单详情
    buy: '买入',
    sell: '卖出',
    limit: '限价',
    market: '市价',
    price: '价格',
    quantity: '数量',
    avgPrice: '成交均价',
    value: '金额',
    fee: '手续费',
    time: '时间',
    cancel: '取消',
    // 空状态
    noOpenOrders: '暂无活动订单',
    noHistory: '暂无历史订单',
    noTrades: '暂无成交记录',
  },

  // 设置页
  settings: {
    title: '设置',
    comingSoon: '设置页面即将推出...',
  },

  // 图表
  chart: {
    title: '价格图表',
    lineChart: '线图',
    candlestickChart: '蜡烛图',
    dataStale: '数据已过期',
    dataDelayed: '数据延迟',
    resyncing: '重建中...',
  },
};

export type Locale = typeof zhCN;

