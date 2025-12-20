import { describe, it, expect, beforeEach } from 'vitest';
import { OrderBookManager } from './orderbook';

describe('OrderBookManager', () => {
  let manager: OrderBookManager;

  beforeEach(() => {
    manager = new OrderBookManager('BTCUSDT');
  });

  describe('snapshot application', () => {
    it('should apply snapshot correctly', () => {
      const snapshot = {
        lastUpdateId: 100,
        bids: [
          ['50000.00', '1.5'],
          ['49999.00', '2.0'],
          ['49998.00', '0.5'],
        ] as [string, string][],
        asks: [
          ['50001.00', '1.0'],
          ['50002.00', '1.5'],
          ['50003.00', '2.0'],
        ] as [string, string][],
      };

      manager.applySnapshot(snapshot);

      expect(manager.isInitialized).toBe(true);
      expect(manager.lastUpdateId).toBe(100);

      const orderBook = manager.getOrderBook();
      expect(orderBook.bids).toHaveLength(3);
      expect(orderBook.asks).toHaveLength(3);
      expect(orderBook.bids[0]?.price).toBe('50000.00');
      expect(orderBook.asks[0]?.price).toBe('50001.00');
    });

    it('should ignore zero quantity levels', () => {
      const snapshot = {
        lastUpdateId: 100,
        bids: [
          ['50000.00', '1.5'],
          ['49999.00', '0'], // Should be ignored
        ] as [string, string][],
        asks: [
          ['50001.00', '1.0'],
        ] as [string, string][],
      };

      manager.applySnapshot(snapshot);

      const orderBook = manager.getOrderBook();
      expect(orderBook.bids).toHaveLength(1);
    });
  });

  describe('delta processing', () => {
    beforeEach(() => {
      manager.applySnapshot({
        lastUpdateId: 100,
        bids: [['50000.00', '1.0']] as [string, string][],
        asks: [['50001.00', '1.0']] as [string, string][],
      });
    });

    it('should apply valid delta update', () => {
      const update = {
        e: 'depthUpdate',
        E: Date.now(),
        s: 'BTCUSDT',
        U: 101,
        u: 101,
        b: [['50000.00', '2.0']] as [string, string][],
        a: [['50001.00', '1.5']] as [string, string][],
      };

      const result = manager.processUpdate(update as never);

      expect(result.success).toBe(true);
      expect(result.needsResync).toBe(false);
      expect(manager.lastUpdateId).toBe(101);

      const orderBook = manager.getOrderBook();
      expect(orderBook.bids[0]?.quantity).toBe('2.0');
      expect(orderBook.asks[0]?.quantity).toBe('1.5');
    });

    it('should detect gap and trigger resync', () => {
      const update = {
        e: 'depthUpdate',
        E: Date.now(),
        s: 'BTCUSDT',
        U: 105, // Gap: expecting 101, got 105
        u: 105,
        b: [] as [string, string][],
        a: [] as [string, string][],
      };

      // Need multiple failures to trigger resync
      manager.processUpdate(update as never);
      manager.processUpdate(update as never);
      const result = manager.processUpdate(update as never);

      expect(result.success).toBe(false);
      expect(result.needsResync).toBe(true);
    });

    it('should remove level when quantity is zero', () => {
      const update = {
        e: 'depthUpdate',
        E: Date.now(),
        s: 'BTCUSDT',
        U: 101,
        u: 101,
        b: [['50000.00', '0']] as [string, string][], // Remove bid level
        a: [] as [string, string][],
      };

      manager.processUpdate(update as never);

      const orderBook = manager.getOrderBook();
      expect(orderBook.bids).toHaveLength(0);
    });
  });

  describe('derived metrics', () => {
    beforeEach(() => {
      manager.applySnapshot({
        lastUpdateId: 100,
        bids: [
          ['50000.00', '1.0'],
          ['49999.00', '2.0'],
          ['49998.00', '3.0'],
        ] as [string, string][],
        asks: [
          ['50001.00', '1.5'],
          ['50002.00', '2.5'],
          ['50003.00', '3.5'],
        ] as [string, string][],
      });
    });

    it('should calculate mid price', () => {
      const metrics = manager.getMetrics();
      const mid = parseFloat(metrics.mid);
      expect(mid).toBeCloseTo(50000.5, 2);
    });

    it('should calculate spread', () => {
      const metrics = manager.getMetrics();
      const spread = parseFloat(metrics.spread);
      expect(spread).toBeCloseTo(1.0, 2);
    });

    it('should calculate spread in basis points', () => {
      const metrics = manager.getMetrics();
      // Spread = 1, Mid = 50000.5
      // spreadBps = (1 / 50000.5) * 10000 ≈ 0.2
      expect(metrics.spreadBps).toBeGreaterThan(0);
      expect(metrics.spreadBps).toBeLessThan(1);
    });

    it('should calculate bid/ask imbalance', () => {
      const metrics = manager.getMetrics();
      // Bids: 1 + 2 + 3 = 6 (top 5, but only 3)
      // Asks: 1.5 + 2.5 + 3.5 = 7.5
      // Imbalance = (6 - 7.5) / (6 + 7.5) = -1.5 / 13.5 ≈ -0.11
      expect(metrics.bidAskImbalance).toBeLessThan(0);
    });

    it('should calculate liquidity score', () => {
      const metrics = manager.getMetrics();
      expect(metrics.liquidityScore).toBeGreaterThan(0);
      expect(metrics.liquidityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('stale detection', () => {
    it('should mark as stale when not initialized', () => {
      expect(manager.checkStale()).toBe(true);
    });

    it('should not be stale immediately after snapshot', () => {
      manager.applySnapshot({
        lastUpdateId: 100,
        bids: [['50000.00', '1.0']] as [string, string][],
        asks: [['50001.00', '1.0']] as [string, string][],
      });

      expect(manager.checkStale()).toBe(false);
    });
  });
});





