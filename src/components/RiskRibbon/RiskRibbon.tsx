import { useMemo } from 'react';
import { useTradingStore, selectBalances } from '../../store/tradingStore';
import { useMarketStore, selectMetrics, selectOrderBook } from '../../store/marketStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import styles from './RiskRibbon.module.css';

interface RiskMetrics {
  positionSizePercent: number;  // Position size as % of total portfolio
  unrealizedPnlPercent: number; // Unrealized P&L as % of entry
  volatilityRisk: number;       // 0-100 based on microVolatility percentile
  hasRealTimePrice: boolean;    // 是否有实时价格用于计算盈亏
}

export function RiskRibbon() {
  const { t } = useI18n();
  const balances = useTradingStore(selectBalances);
  const positions = useTradingStore((state) => state.positions);
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);

  // 当前选中的币种
  const currentSymbol = orderBook?.symbol || selectedSymbol;

  const riskMetrics = useMemo((): RiskMetrics | null => {
    if (!metrics) return null;

    // Calculate total account value
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    const usdtTotal = parseFloat(usdtBalance?.total ?? '0');
    
    // 查找当前选中币种的持仓（只有当前币种才能计算实时盈亏）
    const positionEntries = Array.from(positions.entries());
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{t.riskRibbon.title}</span>
        <span className={`${styles.level} ${styles[riskLevel]}`}>
          {getRiskLabel(riskLevel)}
        </span>
      </div>

      {/* Main Risk Ribbon */}
      <div className={`${styles.ribbon} ${styles[riskLevel]} ${riskMetrics.volatilityRisk > 50 ? styles.volatile : ''}`}>
        {/* Position Size Segment */}
        <div 
          className={styles.segment}
          style={{ width: `${Math.min(riskMetrics.positionSizePercent, 100)}%` }}
          data-tooltip={`${t.riskRibbon.positionRatio}: ${riskMetrics.positionSizePercent.toFixed(1)}%`}
        >
          <div className={`${styles.segmentFill} ${
            riskMetrics.unrealizedPnlPercent >= 0 ? styles.profit : styles.loss
          }`} />
        </div>
      </div>

      {/* Metrics */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>{t.riskRibbon.positionRatio}</span>
          <span className={`${styles.metricValue} tabular-nums`}>
            {riskMetrics.positionSizePercent.toFixed(1)}%
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>{t.riskRibbon.unrealizedPnL}</span>
          <span className={`${styles.metricValue} tabular-nums ${
            riskMetrics.unrealizedPnlPercent >= 0 ? 'price-up' : 'price-down'
          }`}>
            {riskMetrics.unrealizedPnlPercent >= 0 ? '+' : ''}
            {riskMetrics.unrealizedPnlPercent.toFixed(2)}%
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>{t.riskRibbon.volatilityRisk}</span>
          <span className={`${styles.metricValue} tabular-nums`}>
            {riskMetrics.volatilityRisk.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}
