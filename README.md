# TBT Exchange UI Kit

![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-strict-green.svg)
![React](https://img.shields.io/badge/react-18.3-61DAFB.svg)
![Architecture](https://img.shields.io/badge/architecture-production%20ready-orange.svg)

<div align="center">
  <h3>A Performance-Focused React Base for Crypto Exchanges</h3>
  <p>
    An open-source reference implementation for high-frequency trading interfaces.<br>
    Features <b>WebWorker data ingestion</b>, <b>order book merging</b>, and <b>decimal arithmetic</b> out of the box.
  </p>
  <br>
  <p>
    <a href="docs/README_ARCHITECTURE.md"><b>Architecture Documentation</b></a> |
    <a href="docs/benchmarks.md"><b>Performance Benchmarks</b></a>
  </p>
</div>

---

## 💎 Overview

<div align="center">
  <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/pc-%E4%BA%A4%E6%98%93.png" alt="Desktop Trading Interface" width="100%" style="border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);">
</div>

Developing a trading terminal requires solving typical engineering challenges: high-frequency state updates, main-thread blocking, and floating-point precision errors.

This repository provides a solid architectural foundation for these problems. It is designed to be **backend-agnostic**—while it connects to Binance Public Streams for demonstration, the data layer is decoupled and can be adapted to any WebSocket API.

### Key Capabilities

* **High-Frequency Updates**: Handles 50+ WebSocket messages/second via Worker thread offloading.
* **Client-Side Matching**: Includes a local matching engine (Limit, Market, Stop-Limit, OCO) for simulation or testing purposes.
* **Dual-Platform Architecture**: Serves distinct layouts for Mobile and Desktop users via adaptive routing.

---

## 🛠 Reusable Modules

The codebase is structured to allow developers to extract specific subsystems for their own projects.

| Module | Description | Location |
| :--- | :--- | :--- |
| **Order Book Engine** | Manages snapshot synchronization, incremental delta merging (`u`, `U`), and data integrity checks. | `src/worker/` |
| **Trading Logic** | Core order validation, balance checks, and matching logic for standard crypto order types. | `src/store/tradingStore.ts` |
| **Adaptive Layout** | A routing pattern that loads platform-specific component trees based on device capability. | `src/components/Layout/` |
| **Precision Math** | A strict wrapper around `decimal.js` to ensure safe financial calculations throughout the app. | `src/utils/decimal.ts` |

---

## 📱 Mobile Experience

The application implements a "Native-Like" web experience for mobile users. It eschews simple responsiveness for a dedicated mobile specific navigation structure and touch-optimized controls.

<div align="center">
  <table style="border: none; border-collapse: collapse; width: 100%;">
    <tr>
      <td align="center" width="25%" style="border: none; padding: 10px;">
        <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E5%B8%82%E5%9C%BA.png" alt="Markets" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <br><b>Market List</b>
      </td>
      <td align="center" width="25%" style="border: none; padding: 10px;">
        <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E4%BA%A4%E6%98%93.png" alt="Trading" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <br><b>Order Entry</b>
      </td>
      <td align="center" width="25%" style="border: none; padding: 10px;">
        <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E6%B7%B1%E5%BA%A6%E5%9B%BE.png" alt="Depth" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <br><b>Order Book</b>
      </td>
      <td align="center" width="25%" style="border: none; padding: 10px;">
        <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E8%B5%84%E9%87%91%E8%B4%A6%E5%8F%B7.png" alt="Assets" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <br><b>Assets & PnL</b>
      </td>
    </tr>
  </table>
</div>

---

## ⚡ Architecture

The system uses a **Worker-first** approach to ensure the UI thread remains responsive under heavy load.

```mermaid
graph LR
    Binance(External Data Source) -->|WebSocket| Worker[Web Worker Thread]
    Worker -->|Buffer & Merge| Worker
    Worker -->|Throttled Dispatch| Store[Zustand Store]
    Store -->|Atomic Update| Component[React UI]
```

* **Ingestion**: `marketDataWorker` processes the raw WebSocket stream.
* **Throttling**: Updates are batched and dispatched to the main thread at a fixed 60fps interval.
* **State**: Business logic is isolated in Stores and Workers, keeping React components purely presentational.

---

## 🚀 Quick Start

1. **Clone the repository**

    ```bash
    git clone https://github.com/TheNewMikeMusic/tbt-paper-terminal.git
    cd tbt-paper-terminal
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Start development server**

    ```bash
    npm run dev
    # -> http://localhost:5173
    ```

---

<p align="center">
  <sub>Open Source (Apache-2.0). Free to fork and adapt for commercial or private projects.</sub>
</p>
