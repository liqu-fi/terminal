# ⚡ TBT Paper Terminal

<div align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="TBT Logo" />
  <h1>Standard for High-Frequency Trading UI Engineering</h1>
  <p>
    <b>Enterprise-Grade React Architecture • Web Worker Offloading • 0ms UI Blocking</b>
  </p>
  <p>
    A production-ready simulation terminal proving that <b>JavaScript can handle institutional speeds</b>.
    <br />
    <i>Designed for Employers, Buyers, and Senior Engineers.</i>
  </p>
</div>

<div align="center">
  <a href="#-technical-architecture">View Architecture</a> •
  <a href="#-mobile-vs-desktop">Mobile Experience</a> •
  <a href="#-performance--benchmarks">Benchmarks</a>
</div>

<br />

<div align="center">
  <!-- Desktop Hero -->
  <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/pc-%E6%80%BB%E8%A7%88.png" alt="TBT Terminal Overview" width="100%" style="border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Architecture-Web_Worker-success?style=for-the-badge&logo=web" alt="Web Worker">
  <img src="https://img.shields.io/badge/Performance-60_FPS-orange?style=for-the-badge&logo=speedtest" alt="Performance">
</div>

---

## 🧐 Problem & Solution

**The Challenge**: Building a crypto trading terminal in the browser is hard. WebSocket feeds for pairs like `BTC/USDT` push 50+ updates per second. Naive React implementations (Main thread data processing, Context API updates) result in **frozen UIs, unresponsive buttons, and memory leaks**.

**The TBT Solution**:

* **Off-Main-Thread Architecture**: Logic runs in a dedicated `WebWorker`, keeping the UI thread free for user interactions.
* **Atomic Updates**: Used `Zustand` to surgically update only the components that change (e.g., a single price cell) without re-rendering the whole page.
* **Financial Safety**: Integrated `decimal.js` to strictly eliminate floating-point math errors (`0.1 + 0.2 !== 0.3`).

---

## 📱 Mobile vs Desktop

The application implements a "True Responsive" strategy. It doesn't just squash the Desktop UI; it serves optimized layouts and interaction patterns for touch devices.

| **Desktop Pro** | **Mobile Lite** |
| :--- | :--- |
| **Multi-Panel Layout**: Chart, OrderBook, and Trades visible simultaneously. | **Tabbed Interface**: Focused views for Trading, Markets, and Assets to maximize screen space. |
| **Mouse-First**: Hover tooltips, right-click context menus. | **Touch-First**: Large tap targets, bottom-sheet menus. |
| ![Desktop](https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/pc-%E4%BA%A4%E6%98%93.png) | ![Mobile](https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E4%BA%A4%E6%98%93.png) |

---

## 🏗 Technical Architecture

> For a deep dive, read the **[Architecture Documentation](docs/README_ARCHITECTURE.md)**.

### Data Flow Pipeline

We treat data as a stream, not a state.

```mermaid
graph LR
    B(Binance WS) -->|Raw JSON| W[Web Worker]
    W -->|Normalize & Merge| W
    W -.->|Throttled Batch (250ms)| S[Zustand Store]
    S -->|Atomic Selector| C[React Component]
```

### Key Engineering Decisions

* **Packet Handling**: Implemented a sliding window buffer to detect network jitter and packet loss (`gap_detected` events).
* **Backpressure System**: The Worker automatically downsamples trade ticks when the persistent queue exceeds 1,000 items (e.g., during market crashes).
* **Resiliency**: Auto-switching WebSocket URLs (`wss://stream.binance.com:9443` -> `:443`) on connection failure.

---

## ⚡ Performance & Benchmarks

Measurable metrics verified on `M1 Pro / Chrome 120`:

| Metric | Target | **TBT Actual** | Technique Used |
| :--- | :--- | :--- | :--- |
| **FPS (Heavy Load)** | 60 FPS | **58-60 FPS** | Worker Offloading |
| **Input Latency** | < 16ms | **~8ms** | Non-blocking Render |
| **Re-renders/sec** | < 10 | **~4** | `React.memo` + Atomic State |
| **WS Throughput** | 100 msg/s | **1,200+ msg/s** | Batch Processing |

*You can verify this by opening Chrome DevTools > Performance tab while the order book is running.*

---

## 💼 Business Ready Features

This isn't just a tech demo. It's a white-label ready trading engine base.

* ✅ **Advanced Order Types**: Limit, Market, Stop-Limit, Trailing Stop, OCO (One-Cancels-Other).
* ✅ **Risk Engine**: Pre-trade balance checks and isolation margin logic simulation.
* ✅ **Asset Management**: Real-time portfolio valuation based on mark price.
* ✅ **Localization**: Ready for i18n implementation (architected for dictionary swapping).

<div align="center" style="gap: 10px; display: flex; flex-wrap: wrap; justify-content: center;">
  <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/pc-%E9%92%B1%E5%8C%85.png" width="45%" style="border-radius: 6px;">
  <img src="https://pub-4fa9a369b6ad485cb504f5317a258988.r2.dev/%E6%89%8B%E6%9C%BA-%E8%B5%84%E9%87%91%E8%B4%A6%E5%8F%B7.png" width="45%" style="border-radius: 6px;">
</div>

---

## 🚀 Quick Start

1. **Clone & Install**

    ```bash
    git clone https://github.com/TheNewMikeMusic/tbt-paper-terminal.git
    npm install
    ```

2. **Run Development Environment**

    ```bash
    npm run dev
    # Opens at http://localhost:5173
    ```

3. **Run Tests**

    ```bash
    npm test
    # Runs Vitest suite for Worker logic and Store reducers
    ```

---

## 🤝 Services & Contact

**Looking for a Senior Frontend Engineer?**

I specialize in high-performance web applications where "fast enough" isn't enough.

* **Engineering**: I can optimize your existing React app or build scalable architecture from scratch.
* **White-Label**: This terminal code is available for licensing or customization for your exchange/brokerage.

**Contact**:

* [GitHub Profile](https://github.com/TheNewMikeMusic)
* [Email](mailto:your-email@example.com) (Replace with your email)
* [LinkedIn](https://linkedin.com/in/yourprofile) (Replace with your profile)

---
<p align="center">
  <sub>All data sourced from Binance Public API. System is for paper trading simulation only.</sub>
</p>
