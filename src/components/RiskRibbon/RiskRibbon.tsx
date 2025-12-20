import React, { useMemo, useEffect } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useMarketStore, selectMetrics, selectOrderBook } from '../../store/marketStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './RiskRibbon.module.css';

interface RiskMetrics {
  positionSizePercent: number;  // Position size as % of total portfolio
  unrealizedPnlPercent: number; // Unrealized P&L as % of entry
  volatilityRisk: number;       // 0-100 based on microVolatility percentile
  hasRealTimePrice: boolean;    // 是否有实时价格用于计算盈亏
}

interface RiskRibbonProps {
  compact?: boolean;
}

export function RiskRibbon({ compact = false }: RiskRibbonProps) {
  const { t } = useI18n();
  const balances = useWalletStore(selectBalances);
  const performanceMetrics = useWalletStore((state) => state.performanceMetrics);
  const updatePerformanceMetrics = useWalletStore((state) => state.updatePerformanceMetrics);
  const positions = useTradingStore((state) => state.positions);
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);

  // 定期更新绩效指标
  useEffect(() => {
    if (!metrics) return;
    
    // 我们假设当前选中的价格可以代表主要资产价格（简化的 equity 计算）
    const prices: Record<string, string> = {};
    if (metrics.mid && orderBook?.symbol) {
      prices[orderBook.symbol] = metrics.mid;
    }
    
    updatePerformanceMetrics(prices);
  }, [metrics, orderBook?.symbol, updatePerformanceMetrics]);

  // 当前选中的币种
  const currentSymbol = orderBook?.symbol || selectedSymbol;

  const riskMetrics = useMemo((): RiskMetrics | null => {
    if (!metrics) return null;

    // Calculate total account value
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    const usdtTotal = parseFloat(usdtBalance?.total ?? '0');
    
    // 查找当前选中币种的持仓（只有当前币种才能计算实时盈亏）
    let positionEntries: [string, any][] = [];
    if (positions instanceof Map) {
      positionEntries = Array.from(positions.entries());
    } else if (typeof positions === 'object' && positions !== null) {
      positionEntries = Object.entries(positions);
    }

    const activePosition = positionEntries.find(([symbol, pos]) => 
      symbol === currentSymbol && pos.side === 'long' && parseFloat(pos.quantity) > 0
    );

    if (!activePosition) {
      // 检查是否有其他币种的持仓
      const hasOtherPositions = positionEntries.some(([_, pos]) =>
        pos.side === 'long' && parseFloat(pos.quantity) > 0
      );
      
      return {
        positionSizePercent: 0,
        unrealizedPnlPercent: 0,
        volatilityRisk: 0,
        hasRealTimePrice: !hasOtherPositions, // 如果没有任何持仓，显示正常
      };
    }

    const [_, position] = activePosition;
    const qty = parseFloat(position.quantity);
    const avgEntry = parseFloat(position.avgEntryPrice);
    const currentPrice = parseFloat(metrics.mid);
    
    const positionValue = qty * currentPrice;
    const totalValue = usdtTotal + positionValue;
    const positionSizePercent = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;
    
    const unrealizedPnl = qty * (currentPrice - avgEntry);
    const unrealizedPnlPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;

    // Volatility risk: map microVolatility to 0-100
    // Assuming typical BTC volatility range is 0-500 (in price terms)
    const volatility = metrics.microVolatility;
    const volatilityRisk = Math.min(100, (volatility / 100) * 100);

    return {
      positionSizePercent,
      unrealizedPnlPercent,
      volatilityRisk,
      hasRealTimePrice: currentPrice > 0,
    };
  }, [balances, positions, metrics, currentSymbol]);

  if (!riskMetrics) return null;

  const hasPosition = riskMetrics.positionSizePercent > 0;

  // Calculate overall risk level
  const overallRisk = Math.min(100, 
    (riskMetrics.positionSizePercent * 0.4) + 
    (Math.abs(riskMetrics.unrealizedPnlPercent) * 0.3) + 
    (riskMetrics.volatilityRisk * 0.3)
  );

  const getRiskColor = (risk: number) => {
    if (risk < 30) return 'low';
    if (risk < 60) return 'medium';
    return 'high';
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'low': return t.riskRibbon.low;
      case 'medium': return t.riskRibbon.medium;
      case 'high': return t.riskRibbon.high;
      default: return level;
    }
  };

  const riskLevel = getRiskColor(overallRisk);

  // Compact mode for mobile - just show key metrics inline
  if (compact) {
    return (
      <div className={styles.compactContainer}>
        <div className={`${styles.compactLevel} ${styles[riskLevel]}`}>
          <Icon name="shield" size="xs" />
          {getRiskLabel(riskLevel)}
        </div>
        <span className={styles.compactDivider}>|</span>
        <span className={styles.compactMetric}>
          Pos: {riskMetrics.positionSizePercent.toFixed(0)}%
        </span>
        <span className={`${styles.compactMetric} ${
          riskMetrics.unrealizedPnlPercent >= 0 ? styles.positive : styles.negative
        }`}>
          {riskMetrics.unrealizedPnlPercent >= 0 ? '+' : ''}
          {riskMetrics.unrealizedPnlPercent.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Icon name="shield" size="xs" className={styles.riskIcon} />
          <span className={styles.title}>{t.riskRibbon.title}</span>
        </div>
        <div className={`${styles.level} ${styles[riskLevel]}`}>
          {getRiskLabel(riskLevel)}
        </div>
      </div>

      <div className={styles.ribbon}>
        <div 
          className={`${styles.segmentFill} ${
            riskMetrics.unrealizedPnlPercent >= 0 ? styles.profit : styles.loss
          }`}
          style={{ width: `${Math.min(riskMetrics.positionSizePercent, 100)}%` }}
        />
      </div>

      <div className={styles.perfGrid}>
        <div className={styles.perfItem} title={t.riskRibbon.positionRatio}>
          <span className={styles.perfLabel}>Pos</span>
          <span className={styles.perfValue}>
            {riskMetrics.positionSizePercent.toFixed(1)}%
          </span>
        </div>
        <div className={styles.perfItem} title={t.riskRibbon.unrealizedPnL}>
          <span className={styles.perfLabel}>PnL</span>
          <span className={`${styles.perfValue} ${
            riskMetrics.unrealizedPnlPercent >= 0 ? styles.positive : styles.negative
          }`}>
            {riskMetrics.unrealizedPnlPercent >= 0 ? '+' : ''}
            {riskMetrics.unrealizedPnlPercent.toFixed(2)}%
          </span>
        </div>
        <div className={styles.perfItem} title={t.riskRibbon.winRate}>
          <span className={styles.perfLabel}>Win</span>
          <span className={styles.perfValue}>
            {(performanceMetrics.winRate * 100).toFixed(0)}%
          </span>
        </div>
        <div className={styles.perfItem} title={t.riskRibbon.profitFactor}>
          <span className={styles.perfLabel}>PF</span>
          <span className={styles.perfValue}>
            {performanceMetrics.profitFactor.toFixed(2)}
          </span>
        </div>
        <div className={styles.perfItem} title={t.riskRibbon.maxDrawdown}>
          <span className={styles.perfLabel}>DD</span>
          <span className={`${styles.perfValue} ${styles.negative}`}>
            -{performanceMetrics.maxDrawdown.toFixed(0)}%
          </span>
        </div>
        <div className={styles.perfItem} title={t.riskRibbon.totalRealizedPnl}>
          <span className={styles.perfLabel}>Real</span>
          <span className={`${styles.perfValue} ${parseFloat(performanceMetrics.totalRealizedPnl) >= 0 ? styles.positive : styles.negative}`}>
            {parseFloat(performanceMetrics.totalRealizedPnl) >= 0 ? '+' : ''}{performanceMetrics.totalRealizedPnl}
          </span>
        </div>
      </div>
    </div>
  );
}
