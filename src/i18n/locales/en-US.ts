import type { Locale } from './zh-CN';

export const enUS: Locale = {
  // Common
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    save: 'Save',
    reset: 'Reset',
    copy: 'Copy',
    copied: 'Copied',
    more: 'More',
    less: 'Less',
    all: 'All',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    info: 'Info',
  },

  // Header
  header: {
    title: 'Trading Platform',
    subtitle: 'Trading Platform',
    paperTrading: '',
    disclaimer: '',
  },

  // Symbol Selector
  symbolSelector: {
    label: 'Symbol',
    placeholder: 'Symbol (e.g., BTCUSDT)',
    popular: 'Popular',
    all: 'All',
  },

  // Theme
  theme: {
    light: 'Light Mode',
    dark: 'Dark Mode',
    toggle: 'Toggle Theme',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
  },

  // Language
  language: {
    label: 'Language',
    zh: '中文',
    en: 'English',
  },

  // Data Confidence - Honest System Core
  dataConfidence: {
    title: 'Data Confidence',
    // Four confidence levels
    live: 'Live',
    liveDesc: 'Real-time data sync, trading enabled',
    degraded: 'Degraded',
    degradedDesc: 'Data may be delayed, proceed with caution',
    resyncing: 'Resyncing',
    resyncingDesc: 'Rebuilding order book, data may be incomplete',
    stale: 'Stale',
    staleDesc: 'Data expired, trading disabled',
    metricsUncertain: 'Metrics may be inaccurate',
    // Connection states
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting',
    // Metrics
    latency: 'Latency',
    lastUpdate: 'Last Update',
    messageRate: 'Message Rate',
    messagesPerSecond: 'msg/s',
    gapCount: 'Sequence Gaps',
    resyncCount: 'Resync Count',
    queueLength: 'Queue Length',
    reconnectCount: 'Reconnects',
    // Status labels
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    // Details panel
    systemStatus: 'System Status',
    wsConnection: 'WebSocket Connection',
    sequenceCheck: 'Sequence Validation',
    latencyCheck: 'Latency Check',
    updateFrequency: 'Update Frequency',
    queueHealth: 'Queue Health',
    passed: 'OK',
    failed: 'Failed',
    cannotTrade: 'Data syncing',
    lastLiveTime: 'Last Live Time',
    degradedDuration: 'Degraded Duration',
    // Diagnostics drawer
    diagnostics: 'Diagnostics',
    provider: 'Provider',
    reconnect: 'Reconnect',
    forceResync: 'Force Resync',
    truthTimeline: 'Truth Timeline',
    sessionStats: 'Session Statistics',
    avgLatency: 'Avg Latency',
    // Status reason messages
    waitingConnection: 'Waiting for connection...',
    connectionDisconnected: 'Connection disconnected',
    establishingConnection: 'Establishing connection...',
    rebuildingData: 'Rebuilding data...',
    waitingData: 'Waiting for data...',
    dataExpired: 'Data expired',
    highLatency: 'High latency',
    highLatencyWithValue: 'High latency ({latency}ms)',
    longUpdateInterval: 'Long update interval',
    lowMessageRate: 'Low message rate ({rate}/s)',
    recentGaps: '{count} sequence gaps recently',
    dataSyncing: 'Data syncing in real-time',
    workerInitFailed: 'Worker initialization failed',
    workerCreateFailed: 'Worker creation failed',
  },

  // Network Health
  networkHealth: {
    title: 'Network Health',
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    improving: 'Improving',
    stable: 'Stable',
    degrading: 'Degrading',
    // Score components
    latencyScore: 'Latency',
    stabilityScore: 'Stability',
    throughputScore: 'Throughput',
    reliabilityScore: 'Reliability',
    // Statistics
    sessionDuration: 'Session',
    uptime: 'Uptime',
    avgLatency: 'Avg Latency',
    p95Latency: 'P95 Latency',
    minLatency: 'Min',
    maxLatency: 'Max',
    noEvents: 'No events yet',
    // Event types
    events: {
      connected: 'Connected',
      disconnected: 'Disconnected',
      reconnecting: 'Reconnecting',
      latencySpike: 'Latency Spike',
      latencyNormal: 'Latency Normal',
      gapDetected: 'Gap Detected',
      resyncStart: 'Resync Start',
      resyncComplete: 'Resync Complete',
      rateDrop: 'Rate Drop',
      rateNormal: 'Rate Normal',
    },
  },

  // Order Book
  orderBook: {
    title: 'Order Book',
    price: 'Price',
    amount: 'Amount',
    total: 'Total',
    bids: 'Bids',
    asks: 'Asks',
    spread: 'Spread',
    spreadBps: 'bps',
    depthLevels: 'Depth Levels',
    midPrice: 'Mid Price',
    imbalance: 'Imbalance',
    imbalanceBuy: 'Buy Pressure',
    imbalanceSell: 'Sell Pressure',
    imbalanceNeutral: 'Neutral',
  },

  // Recent Trades
  recentTrades: {
    title: 'Recent Trades',
    time: 'Time',
    price: 'Price',
    amount: 'Amount',
    side: 'Side',
    buy: 'Buy',
    sell: 'Sell',
    noTrades: 'No trades yet',
  },

  // Metrics
  metrics: {
    title: 'Market Metrics',
    midPrice: 'Mid Price',
    spread: 'Spread',
    imbalance: 'Imbalance',
    volatility: 'Volatility',
    tradeIntensity: 'Trade Intensity',
    vwap: 'VWAP',
    liquidityScore: 'Liquidity Score',
    slippageEst: 'Slippage Est.',
    
    midPriceDesc: 'Middle price between best bid and ask',
    spreadDesc: 'Bid-ask spread (absolute/bps)',
    imbalanceDesc: 'Buy/sell pressure ratio (-1 to 1)',
    volatilityDesc: 'Price volatility over 60 seconds',
    tradeIntensityDesc: 'Trade count in last 10 seconds',
    vwapDesc: 'Volume-weighted average price',
    liquidityScoreDesc: 'Liquidity score from 0-100',
    slippageEstDesc: 'Estimated slippage for 0.1 unit market order',
  },

  // Order Entry
  orderEntry: {
    title: 'Order Entry',
    buy: 'Buy',
    sell: 'Sell',
    market: 'Market',
    limit: 'Limit',
    price: 'Price',
    amount: 'Amount',
    total: 'Total',
    available: 'Available',
    max: 'Max',
    percent25: '25%',
    percent50: '50%',
    percent75: '75%',
    percent100: '100%',
    placeOrder: 'Place Order',
    placeBuyOrder: 'Buy {symbol}',
    placeSellOrder: 'Sell {symbol}',
    confirmOrder: 'Confirm Order',
    orderPlaced: 'Order Placed',
    orderFailed: 'Order Failed',
    insufficientBalance: 'Insufficient Balance',
    invalidPrice: 'Please enter a valid price',
    invalidAmount: 'Please enter a valid amount',
    minAmount: 'Min amount: {min}',
    focusMode: 'Focus Mode',
    focusModeHint: 'Price updates won\'t interrupt input',
    // Quick fill
    bid1: 'Bid1',
    ask1: 'Ask1',
    mid: 'Mid',
    // Step control
    stepUp: 'Increase',
    stepDown: 'Decrease',
    // Degraded confirm
    confirmDegraded: 'Data may be delayed, confirm submit?',
    // Estimated info
    estimatedPrice: 'Est. Price',
    slippage: 'Slippage',
    fee: 'Fee',
    pricePlaceholder: '0.00',
    amountPlaceholder: '0.00',
    // Quick actions
    allInBuy: 'All-In Buy',
    allInSell: 'Sell All',
    // All-in confirm modal
    confirmAllInBuyTitle: 'Confirm All-In Buy',
    confirmAllInSellTitle: 'Confirm Sell All',
    confirmAllInBuyMessage: 'Use all available funds to buy',
    confirmAllInSellMessage: 'Sell all holdings',
    confirmAllInBuy: 'Confirm Buy',
    confirmAllInSell: 'Confirm Sell',
  },

  // Open Orders
  openOrders: {
    title: 'Open Orders',
    noOrders: 'No open orders',
    orderId: 'Order ID',
    symbol: 'Symbol',
    side: 'Side',
    type: 'Type',
    price: 'Price',
    amount: 'Amount',
    filled: 'Filled',
    remaining: 'Remaining',
    status: 'Status',
    time: 'Time',
    cancel: 'Cancel',
    cancelAll: 'Cancel All',
    cancelConfirm: 'Cancel this order?',
    cancelAllConfirm: 'Cancel all open orders?',
    cancelled: 'Cancelled',
    cancelFailed: 'Cancel Failed',
  },

  // Order Status
  orderStatus: {
    pending: 'Pending',
    submitted: 'Submitted',
    open: 'Open',
    partial: 'Partial',
    filled: 'Filled',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    expired: 'Expired',
  },

  // Positions
  positions: {
    title: 'Positions',
    noPositions: 'No positions',
    symbol: 'Symbol',
    side: 'Side',
    amount: 'Amount',
    avgPrice: 'Avg Price',
    currentPrice: 'Current',
    unrealizedPnL: 'Unrealized P&L',
    realizedPnL: 'Realized P&L',
    long: 'Long',
    flat: 'Flat',
    close: 'Close',
    closeAll: 'Close All',
    closePosition: 'Market Close',
    marketClose: 'Market Close',
    closeOrderSubmitted: 'Close order submitted',
    switchingSymbol: 'Switching symbol...',
    noMarketData: 'No market data, please try again later',
    // Close position confirm modal
    confirmCloseTitle: 'Confirm Close Position',
    confirmCloseMessage: 'Are you sure to market sell all holdings?',
    confirmClose: 'Confirm Close',
  },

  // Account
  account: {
    title: 'Account',
    balance: 'Balance',
    available: 'Available',
    locked: 'Locked',
    totalValue: 'Total Value',
    unrealizedPnL: 'Unrealized P&L',
    realizedPnL: 'Realized P&L',
    marginUsed: 'Margin Used',
    marginAvailable: 'Available Margin',
  },

  // Risk Ribbon
  riskRibbon: {
    title: 'Risk Overview',
    positionRatio: 'Position Ratio',
    unrealizedPnL: 'Unrealized P&L',
    volatilityRisk: 'Volatility Risk',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    veryHigh: 'Very High',
  },

  // Depth Chart
  depthChart: {
    title: 'Depth Chart',
    bids: 'Bids Depth',
    asks: 'Asks Depth',
    price: 'Price',
    cumulative: 'Cumulative',
    logScale: 'Log Scale',
    linearScale: 'Linear Scale',
  },

  // Welcome
  welcome: {
    title: 'Welcome to Trading Platform',
    subtitle: 'Professional digital asset trading terminal',
    step1Title: 'Live Market Data',
    step1Desc: 'Connect to real-time market data for latest prices and depth information',
    step2Title: 'Order Execution',
    step2Desc: 'Support limit and market orders for fast trading strategy execution',
    step3Title: 'Market Analysis',
    step3Desc: 'Deep insights into market microstructure and order book dynamics',
    getStarted: 'Get Started',
    dontShowAgain: 'Don\'t show again',
    disclaimer: '',
    stepLabel: 'Step {n}',
  },

  // Tips
  tips: {
    orderBookClick: 'Click order book price to fill in order price',
    tradeClick: 'Click trade to view details',
    shortcut: 'Shortcuts',
    shortcuts: {
      buy: 'B - Switch to Buy',
      sell: 'S - Switch to Sell',
      market: 'M - Market Order',
      limit: 'L - Limit Order',
      cancel: 'Esc - Cancel/Close',
      submit: 'Enter - Submit Order',
      theme: 'T - Toggle Theme',
      toggle: 'Show/Hide Shortcuts',
      hint: 'Press ? key anytime',
    },
  },

  // Toast
  toast: {
    orderSubmitted: 'Order submitted',
    orderFilled: 'Order filled',
    orderPartialFilled: 'Order partially filled ({filled}/{total})',
    orderCancelled: 'Order cancelled',
    orderRejected: 'Order rejected: {reason}',
    connectionRestored: 'Connection restored',
    connectionLost: 'Connection lost, reconnecting...',
    dataStale: 'Data may be stale',
    copied: 'Copied to clipboard',
    eventsSuppressed: 'events suppressed',
  },

  // Errors
  errors: {
    networkError: 'Network error, please check connection',
    timeout: 'Request timeout',
    invalidInput: 'Invalid input',
    serverError: 'Server error',
    unknownError: 'Unknown error',
  },

  // Time
  time: {
    justNow: 'Just now',
    secondsAgo: '{n}s ago',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    today: 'Today',
    yesterday: 'Yesterday',
  },

  // Numbers
  numbers: {
    thousand: 'K',
    million: 'M',
    billion: 'B',
    trillion: 'T',
  },

  // Watchlist
  watchlist: {
    title: 'Watchlist',
    searchPlaceholder: 'Search symbols...',
    showAll: 'Show All',
    showFavorites: 'Favorites Only',
    noResults: 'No matching symbols',
    empty: 'Watchlist is empty',
    symbols: 'symbols',
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    pin: 'Pin',
    unpin: 'Unpin',
    toggleFavorite: 'Toggle favorite',
  },

  // Observability
  observability: {
    title: 'Observability',
    metrics: 'Metrics',
    logs: 'Logs',
    systemHealth: 'System Health',
    sessionStats: 'Session Statistics',
    wsConnection: 'WebSocket Connection',
    sequenceCheck: 'Sequence Check',
    latencyCheck: 'Latency Check',
    updateFrequency: 'Update Frequency',
    latency: 'Latency',
    messageRate: 'Message Rate',
    gapCount: 'Gaps',
    resyncCount: 'Resyncs',
    reconnectCount: 'Reconnects',
    confidence: 'Confidence',
    all: 'All',
    warnPlus: 'Warn+',
    error: 'Error',
    clear: 'Clear',
    noLogs: 'No logs',
  },

  // Sound
  sound: {
    enable: 'Enable sound',
    disable: 'Disable sound',
    toggle: 'Toggle sound',
  },

  // Navigation
  nav: {
    trade: 'Trade',
    markets: 'Markets',
    wallet: 'Wallet',
    orders: 'Orders',
  },

  // Markets
  markets: {
    title: 'Markets',
    comingSoon: 'Markets page coming soon...',
    tableView: 'Table View',
    gridView: 'Grid View',
    searchPlaceholder: 'Search symbols...',
    symbol: 'Symbol',
    price: 'Price',
    change24h: '24h Change',
    volume24h: '24h Volume',
    chart: 'Chart',
    actions: 'Actions',
  },

  // Wallet
  wallet: {
    title: 'Wallet',
    comingSoon: 'Wallet page coming soon...',
  },

  // Orders
  orders: {
    title: 'Orders',
    comingSoon: 'Orders page coming soon...',
    // Tabs
    openTab: 'Open Orders',
    historyTab: 'Order History',
    tradesTab: 'Trade History',
    // Stats
    openOrders: 'Open Orders',
    filledOrders: 'Filled',
    totalTrades: 'Total Trades',
    totalVolume: 'Total Volume',
    // Order status
    status: {
      pending: 'Pending',
      submitted: 'Submitted',
      open: 'Open',
      partial: 'Partial',
      filled: 'Filled',
      cancelled: 'Cancelled',
      rejected: 'Rejected',
    },
    // Order details
    buy: 'Buy',
    sell: 'Sell',
    limit: 'Limit',
    market: 'Market',
    price: 'Price',
    quantity: 'Quantity',
    avgPrice: 'Avg Price',
    value: 'Value',
    fee: 'Fee',
    time: 'Time',
    cancel: 'Cancel',
    // Empty states
    noOpenOrders: 'No open orders',
    noHistory: 'No order history',
    noTrades: 'No trade history',
  },

  // Settings
  settings: {
    title: 'Settings',
    comingSoon: 'Settings page coming soon...',
  },

  // Chart
  chart: {
    title: 'Price Chart',
    lineChart: 'Line Chart',
    candlestickChart: 'Candlestick Chart',
    dataStale: 'Data Stale',
    dataDelayed: 'Data Delayed',
    resyncing: 'Resyncing...',
  },
};

