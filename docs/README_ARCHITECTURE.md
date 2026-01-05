# System Architecture

## Core Design Principles

1. **Isolation**: Data processing is isolated from UI rendering.
2. **Precision**: Financial calculations never use native `number`.
3. **Resilience**: Network failures are assumed and handled.

## Directory Structure Strategy

```
src/
├── worker/         # [CRITICAL] WebWorker entry point & logic
│   └── marketDataWorker.ts
├── store/          # Domain-specific Zustand stores
│   ├── marketStore.ts    # High-freq data (throttled)
│   ├── tradingStore.ts   # Matching engine logic
│   └── walletStore.ts    # Asset accounting
├── utils/
│   └── decimal.ts  # Precision math wrapper
└── components/
    └── Layout/
        └── AdaptiveLayout.tsx # Mobile/Desktop branching
```

## Critical Flows

### 1. Order Book Delta Merging

We use a standard snapshot + delta approach.

1. **Fetch**: REST Snapshot (`depth?limit=1000`).
2. **Buffer**: Queue WS events (`depthUpdate`) where `u <= lastUpdateId`.
3. **Playback**: Apply valid buffered deltas.
4. **Sync**: Apply new real-time deltas.
5. **Validation**: Check `u` (final update ID) continuity. If broken -> Resync.

### 2. Matching Engine (Client-Side)

Located in `tradingStore.ts`.

- **Market Orders**: Match immediately against best BBO from `marketStore`.
- **Limit Orders**: Added to `orders` array. Checked on every `metricUpdate` from Worker.
- **Latency Simulation**: Artificial `setTimeout` (50-200ms) added to mimic network round-trips.

## State Management Decisions

| State Type | Solution | Reason |
| :--- | :--- | :--- |
| **High Frequency** (Price, Depth) | `Zustand` (transient) | Avoid boilerplate, high performance selectors. |
| **Derived Data** (P&L) | Computed in Render/Selector | Avoid storing duplicate state. |
| **Configuration** | `localStorage` | Persistence across reloads. |
