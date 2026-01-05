# Performance Benchmarks & Measurement Guide

This document outlines the performance budget and how to verify metrics in `tbt-paper-terminal`.

## Performance Budget

| Metric | Budget | Rationale |
| :--- | :--- | :--- |
| **JS Heap Size** | < 100MB | Long-running tab stability |
| **Main Thread Blocking** | < 50ms | "Jank-free" interactions |
| **Frame Rate** | 60fps | Smooth chart scrolling |
| **WS Latency** | < 200ms | Real-time perception |

## How to Measure

### 1. Verification of Worker Offloading

**Goal**: Confirm that heavy JSON parsing occurs off the main thread.

1. Open Chrome DevTools > **Performance**.
2. Start recording.
3. Let the terminal run for 10 seconds (ensure high activity connection).
4. Stop recording.
5. **Look for**: A separate "Worker" track with high CPU usage (yellow/purple bars).
6. **Verify**: The "Main" track should remain mostly idle (fragmented tasks) even during high WS throughput.

### 2. Measuring Re-render Frequency

**Goal**: Confirm Atomic State updates are working.

1. Install **React Developer Tools**.
2. Open "Profiler" tab -> Settings -> "Highlight updates when components render".
3. Observe the OrderBook:
    * **Pass**: Only specific rows/cells flash green.
    * **Fail**: The entire table or page flashes on every tick.

### 3. Simulating Volatility

To test the `Backpressure` system in `marketDataWorker.ts`, you can artificially flood the queue logic by modifying the worker:

```typescript
// src/worker/marketDataWorker.ts
// Temporary measurement code
setInterval(() => {
  for(let i=0; i<100; i++) {
    handleMessage(mockHeavyPayload); // Flood inputs
  }
}, 100);
```

Check console logs for: `backpressure.warning` or `backpressure.drop`.
