# TBT Paper Terminal

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-strict-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-mobile%20%7C%20desktop-lightgrey.svg)

**Frontend-only Crypto Trading Simulation**. Connects to Binance Public WebSocket API.  
**纯前端加密货币仿真交易终端**。直连 Binance 公共 WebSocket API。

[Architecture Docs](docs/README_ARCHITECTURE.md) | [Performance Benchmarks](docs/benchmarks.md)

---

## 1. What it is / 项目定位

### ✅ It is

* **High-Frequency Data Visualization**: Renders 50+ updates/sec OrderBook via `WebWorker` + `Canvas`.
* **Dual-Platform UX**: Dedicated mobile routing (`/mobile/*`) vs Desktop dashboard.
* **Financial Sandbox**: Risk-free simulation with strict `decimal.js` arithmetic.
* **Zero-Backend**: Client-side matching engine and state persistence.

### ❌ It isn't

* Not a real exchange (No custody, no settlement).
* Not a trading bot (No automated execution strategies).
* Not a "Get Rich Quick" tool.

---

## 2. Features & Implementation / 功能与实现

### 📊 Market Intelligence (行情系统)

* **Order Book**: Incremental depth updates (`depthUpdate` stream).
  * *Implementation*: `src/worker/marketDataWorker.ts` handles delta merging and backpressure.
* **Real-time Charts**: 60fps candlestick rendering.
  * *Implementation*: Integrated `lightweight-charts` with `ResizeObserver`.

### ⚡ Trading Engine (交易核心)

* **Order Types**: Limit, Market, Stop-Limit, OCO, Trailing Stop.
  * *Implementation*: `src/store/tradingStore.ts` implements the matching logic.
* **Position Management**: Isolated Margin methodology approximation.
  * *Implementation*: `src/store/walletStore.ts`.

### 🛡 Engineering Safety (工程保障)

* **Precision Math**: NO floating point errors.
  * *Evidence*: `src/utils/decimal.ts` wrapper used in all stores.
* **Type Safety**: `strict: true` in `tsconfig.json`.

---

## 3. Mobile vs Desktop / 双端体验

The project uses **adaptive routing** (not just CSS breakpoints) to serve distinct interaction models.
项目使用**自适应路由**（而非单纯 CSS 媒体查询）来提供差异化的交互模型的。

See `src/components/Layout/AdaptiveLayout.tsx` for branching logic.

| **Desktop Dashboard** | **Mobile App-Feel** |
| :--- | :--- |
| **High Information Density**<br>Simultaneous Chart/Depth/Trades.<br>Dense data tables. | **Simplified Flows**<br>Tab-based navigation (`src/pages/mobile/*`).<br>Touch-optimized tap targets. |
| ![Desktop Overview](https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/pc-%E6%80%BB%E8%A7%88.png) | ![Mobile Trading](https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E4%BA%A4%E6%98%93.png) |

---

## 4. Architecture & Performance / 架构与性能

### 4.1 Data Flow / 数据流向

```mermaid
graph LR
    WS[Binance WebSocket] -->|JSON Stream| Worker[Web Worker]
    Worker -->|Delta Merge & Queue| Worker
    Worker -->|Throttled Interval (250ms)| Store[Zustand Store]
    Store -->|Atomic Selector| UI[React Components]
```

### 4.2 Performance Tactics / 性能策略

1. **Off-Main-Thread Processing (Worker)**
    * *Why*: Parsing 100+ JSON messages/sec blocks UI interactions.
    * *How*: `src/worker/marketDataWorker.ts` runs in a separate thread.
    * *Evidence*: See `worker.ts` importing `OrderBookManager`.

2. **Render Throttling (Batching)**
    * *Why*: React cannot reconcile 60fps state updates without lag.
    * *How*: Worker accumulates updates and emits only 4 snapshots/sec to the Main Thread.

3. **Atomic State Updates**
    * *Why*: `Context API` triggers full-tree re-renders on price ticks.
    * *How*: `useStore(state => state.specificSlice)` ensures only relevant cells re-render.
    * *Evidence*: `src/store/marketStore.ts`.

> See [docs/benchmarks.md](docs/benchmarks.md) for how to measure these metrics yourself.

---

## 5. Getting Started / 快速运行

**Prerequisites**: Node.js 18+

```bash
# 1. Clone
git clone https://github.com/TheNewMikeMusic/tbt-paper-terminal.git

# 2. Install (using npm)
npm install

# 3. Dev Server
npm run dev
# -> http://localhost:5173
```

**Environment Variables**:
No `.env` required for default mode (Direct connection to Binance Public WS).

---

## 6. Engineering Standards / 工程标准

* **TypeScript**: Strict mode enabled. No `any` allowed in core logic.
* **State Management**: Domain-driven stores (`trading`, `wallet`, `market` split).
* **Error Handling**: WebSocket exponential backoff (`src/worker/marketDataWorker.ts`).

---

## 7. Roadmap / 规划

* [ ] **Replay Mode**: Record and replay market data for backtesting (Complexity: M).
* [ ] **Auth System**: Integrate Supabase/Firebase for cloud persistence (Complexity: M).
* [ ] **Exchange Adapter**: Abstract API layer to support OKX/Bybit (Complexity: L).

---

## 8. Author / 联系作者

**Senior Frontend Engineer** specializing in Real-time Data Visualization and Performance.
Open to technical consulting and integration projects.

* **GitHub**: [TheNewMikeMusic](https://github.com/TheNewMikeMusic)
* **Email**: (Add your email here)
* **LinkedIn**: (Add your profile here)

---
<p align="center">
  <sub>Data source: Binance Public API. Educational use only.</sub>
</p>
