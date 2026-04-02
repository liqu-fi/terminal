import { useMemo } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useMarketStore, selectMetrics, selectOrderBook } from '../../store/marketStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './RiskRibbon.module.css';

interface RiskMetrics {
  positionSizePercent: number;
  unrealizedPnlPercent: number;
  volatilityRisk: number;
  hasRealTimePrice: boolean;
}

interface RiskRibbonProps {
  compact?: boolean;
  full?: boolean;
}

export function RiskRibbon({ compact = false }: RiskRibbonProps) {
  const { t } = useI18n();
  const balances = useWalletStore(selectBalances);
  const positions = useTradingStore((state) => state.positions);
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);

  const currentSymbol = orderBook?.symbol || selectedSymbol;

  const riskMetrics = useMemo((): RiskMetrics | null => {
    if (!metrics) return null;

    const usdtBalance = balances.find(b => b.asset === 'USDT');
    const usdtTotal = parseFloat(usdtBalance?.total ?? '0');

    const positionEntries = Array.from(positions.entries());

    const activePosition = positionEntries.find(([symbol, pos]) =>
      symbol === currentSymbol && pos.side === 'long' && parseFloat(pos.quantity) > 0
    );

    if (!activePosition) {
      return {
        positionSizePercent: 0,
        unrealizedPnlPercent: 0,
        volatilityRisk: 0,
        hasRealTimePrice: true,
      };
    }

    const [_, position] = activePosition;
    const qty = parseFloat(position.quantity);
    const avgEntry = parseFloat(position.avgEntryPrice);
    const currentPrice = parseFloat(metrics.mid);

    const positionValue = qty * currentPrice;
    const totalValue = usdtTotal + positionValue;
    const positionSizePercent = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;

    const unrealizedPnlPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;
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
      </div>
    </div>
  );
}
