# Paper Trading Terminal

A professional paper trading terminal for cryptocurrency markets. Uses real market data from Binance for simulated trading without risk.

![Demo](https://img.shields.io/badge/status-demo-yellow) ![License](https://img.shields.io/badge/license-MIT-blue)

## ⚠️ Disclaimer

- **NOT financial advice** - This is a learning/demo project only
- **Paper trading only** - No real money, no real trades
- **No affiliation with Binance** - Uses public WebSocket API only
- **Data may be delayed** - UI indicates data freshness

## Features

### Real-time Market Data
- ✅ Binance WebSocket connection with automatic reconnection
- ✅ Order book snapshot + delta merging with sequence validation
- ✅ Gap detection and automatic resync
- ✅ Backpressure handling (depth not dropped, trades can be downsampled)
- ✅ Stale data detection and UI warning

### Derived Metrics (8 Indicators)
- ✅ **Mid Price** - (bestBid + bestAsk) / 2
- ✅ **Spread** - Absolute and basis points
- ✅ **Bid/Ask Imbalance** - Buy/sell pressure indicator (-1 to +1)
- ✅ **Micro Volatility** - 60s rolling standard deviation (Welford algorithm)
- ✅ **Trade Intensity** - Trades per 10 seconds
- ✅ **VWAP (60s)** - Volume-weighted average price
- ✅ **Liquidity Score** - Log-normalized depth/spread ratio (0-100)
- ✅ **Slippage Estimate** - Simulated market order impact

### Paper Trading
- ✅ Limit and Market orders
- ✅ Order state machine (pending → submitted → open → partial/filled)
- ✅ Simulated matching against real order book
- ✅ Position and P&L tracking
- ✅ Account balance management with locking

### Professional UI
- ✅ Light/Dark theme (both first-class)
- ✅ Data Confidence Bar - Connection health always visible
- ✅ Focus Mode - Order entry locks layout during input
- ✅ Risk Ribbon - Visual risk assessment
- ✅ Microstructure Lens (Depth Chart) - Visual order book depth
- ✅ Tabular numbers, IBM Plex fonts
- ✅ Color-blind friendly (▲▼ symbols)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management with selectors
- **Web Worker** - Data processing isolated from main thread
- **Vite** - Fast development and builds
- **decimal.js** - Precise financial calculations
- **Vitest** - Unit testing

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI (Main Thread)                         │
│    React + Zustand (局部订阅) + requestAnimationFrame 渲染       │
│    - Order Book, Metrics, Trades, Order Entry, Positions         │
│    - Focus Mode: isolate order entry from data updates           │
└────────────────────────────┬────────────────────────────────────┘
                             │ postMessage (structured cloning)
┌────────────────────────────┴────────────────────────────────────┐
│                        Web Worker                                │
│    - WebSocket connection management (heartbeat, reconnect)      │
│    - Order book snapshot/delta merging with sequence validation  │
│    - Derived metrics calculation (O(1) incremental updates)      │
│    - Backpressure: depth not dropped, trades can be downsampled  │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket + REST
┌────────────────────────────┴────────────────────────────────────┐
│                  Binance Public API                              │
│    wss://stream.binance.com:9443/ws/{symbol}@depth@100ms         │
│    https://api.binance.com/api/v3/depth                          │
└─────────────────────────────────────────────────────────────────┘
```

## Order Book Correctness

The implementation follows Binance's official documentation:

1. **Initialize**: Subscribe to `depth@100ms`, fetch REST snapshot
2. **Merge**: Apply deltas where `U <= lastUpdateId + 1 && u >= lastUpdateId + 1`
3. **Gap Detection**: If `U > lastUpdateId + 1`, trigger resync
4. **Resync Cooldown**: Minimum 5 seconds between resyncs

### Known Limitations (Honestly Stated)

| Limitation | Reason | Mitigation |
|------------|--------|------------|
| 100ms minimum latency | Binance depth stream batches | UI shows actual latency |
| REST/WS time gap | Snapshot may miss some updates | Quick resync, stale marking |
| No SLA | Public API | Latency indicators, reconnect |
| Simulated matching | No real order queue | Document as educational |

## Design System

### Typography
- **Sans**: IBM Plex Sans (UI text)
- **Mono**: IBM Plex Mono (prices, numbers)
- **Tabular nums**: All numeric displays

### Colors
| Element | Light | Dark |
|---------|-------|------|
| Price Up | `#16A34A` | `#22C55E` |
| Price Down | `#DC2626` | `#EF4444` |
| Background | `#FAFBFC` | `#0D1117` |
| Card | `#FFFFFF` | `#161B22` |

### Accessibility
- WCAG AA contrast ratios
- Color-blind friendly: ▲▼ symbols with colors
- Keyboard navigation support
- Focus indicators

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Coverage
- Order book merging (normal, gap, resync)
- Derived metrics calculation
- Order state machine transitions
- Balance locking/unlocking

## Project Structure

```
src/
├── components/          # React components
│   ├── DataConfidenceBar/   # Connection status
│   ├── DepthChart/          # Microstructure lens
│   ├── MetricsPanel/        # Derived indicators
│   ├── OpenOrders/          # Active orders
│   ├── OrderBook/           # Bid/ask display
│   ├── OrderEntry/          # Order form
│   ├── Positions/           # Account & positions
│   ├── RecentTrades/        # Trade history
│   ├── RiskRibbon/          # Risk visualization
│   ├── SymbolSelector/      # Symbol switching
│   └── ThemeToggle/         # Light/dark switch
├── store/
│   ├── marketStore.ts       # Market data state
│   └── tradingStore.ts      # Trading state
├── types/
│   ├── market.ts            # Market data types
│   └── trading.ts           # Trading types
├── worker/
│   ├── marketDataWorker.ts  # WebSocket worker
│   ├── orderbook.ts         # Order book logic
│   └── orderbook.test.ts    # Unit tests
└── styles/
    ├── tokens.css           # Design tokens
    └── global.css           # Global styles
```

## Observability

### Metrics Tracked
- `ws_connection_state` - WebSocket status
- `ws_reconnect_count` - Reconnection attempts
- `ws_message_rate` - Messages per second
- `ob_gap_count` - Sequence gaps detected
- `ob_resync_count` - Resync triggers
- `ob_stale_duration_ms` - Time in stale state

### Log Events
- `ws.connected`, `ws.disconnected`, `ws.reconnect_start`
- `ob.snapshot_complete`, `ob.gap_detected`, `ob.resync_start`
- `order.created`, `order.filled`, `order.cancelled`

## License

MIT - Educational purposes only.

---

Built as a portfolio project demonstrating:
- Real-time data engineering (WebSocket, streaming)
- Financial data correctness (sequence validation, decimal precision)
- Professional trading UI/UX design
- React performance patterns (selectors, workers, RAF)
