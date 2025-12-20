# 🚀 TBT Paper Terminal

<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="TBT Logo">
</p>

<p align="center">
  <b>A professional-grade paper trading terminal for cryptocurrency markets.</b><br>
  Experience institutional-level data handling and professional UI with zero financial risk.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Zustand-State-orange?style=for-the-badge" alt="Zustand">
  <img src="https://img.shields.io/badge/Binance-API-F0B90B?style=for-the-badge&logo=binance" alt="Binance API">
</p>

---

## ✨ Features Highlight

### 📊 Market Intelligence
*   **High-Fidelity Order Book**: Real-time snapshot + delta merging with sequence validation and auto-resync.
*   **Microstructure Indicators**: 8 built-in real-time metrics including **Bid/Ask Imbalance**, **Micro Volatility**, and **VWAP**.
*   **Data Confidence Bar**: Full transparency on connection health, latency (RTT), and data freshness.

### ⚡ Professional Trading Engine
*   **Focus Mode**: Intelligent layout locking during order entry for maximum precision.
*   **Simulated Matching**: Market and Limit orders matched against real-time Binance liquidity.
*   **Risk Ribbon**: Visual risk assessment for position sizing and P&L monitoring.

### 🎨 Modern UI/UX
*   **Dual Themes**: Professional Dark and Light modes out of the box.
*   **Performance First**: Heavy computations (Order book merging, metrics) offloaded to **Web Workers**.
*   **Accessibility**: Color-blind friendly indicators (▲▼) and tabular numeric fonts.

---

## 📸 Interface Preview

| 🌓 Light Mode | 🌑 Dark Mode |
|:---:|:---:|
| ![Light Mode Placeholder](https://via.placeholder.com/600x350/FAFBFC/1F2328?text=Professional+Light+UI) | ![Dark Mode Placeholder](https://via.placeholder.com/600x350/0D1117/E6EDF3?text=High-Density+Dark+UI) |
| *Clean, professional typography* | *Optimized for long-session trading* |

---

## 🛠 Tech Stack

Designed for speed, precision, and educational clarity.

*   **Core**: React 18 + TypeScript
*   **State Management**: Zustand (Atomic subscriptions)
*   **Data Processing**: Web Workers (Dedicated thread for streaming data)
*   **Financial Math**: `decimal.js` for floating-point safety
*   **Visualization**: `lightweight-charts` for high-performance price action

---

## 📉 The 8 Alpha Indicators

The terminal calculates these metrics every 100ms in a background worker:

1.  **Mid Price**: The fair market value baseline.
2.  **Spread**: Real-time liquidity cost (Absolute & Bps).
3.  **Bid/Ask Imbalance**: Buy/Sell pressure signal (-1 to +1).
4.  **Micro Volatility**: 60s rolling risk assessment (Welford algorithm).
5.  **Trade Intensity**: Market activity pulse (Trades per 10s).
6.  **VWAP (60s)**: Volume-weighted average price.
7.  **Liquidity Score**: Log-normalized depth/spread ratio (0-100).
8.  **Slippage Estimate**: Projected price impact for market orders.

---

## 🏗 System Architecture

```mermaid
graph TD
    subgraph "External Data"
        B[Binance WebSocket]
        R[Binance REST API]
    end

    subgraph "Web Worker (Data Layer)"
        WS[WS Manager]
        OB[Order Book Engine]
        ME[Metrics Aggregator]
    end

    subgraph "Main Thread (UI Layer)"
        ZS[Zustand Store]
        RC[React Components]
        SM[Sim Matching Engine]
    end

    B --> WS
    R --> OB
    WS -->|Deltas| OB
    OB -->|Snapshot| ZS
    OB --> ME
    ME -->|Indicators| ZS
    ZS --> RC
    RC -->|New Order| SM
    SM -->|Fills| ZS
```

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/TheNewMikeMusic/tbt-paper-terminal.git

# Install dependencies
npm install

# Start the development server
npm run dev

# Run unit tests
npm test
```

---

## ⚠️ Disclaimer

- **NOT financial advice**: This is for educational and portfolio purposes only.
- **Paper trading only**: No real money or real trades are ever executed.
- **Data Source**: Uses public Binance API. Not affiliated with Binance.

---

<p align="center">
  Built with ❤️ for the Trading Community.
</p>
