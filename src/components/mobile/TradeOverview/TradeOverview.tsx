import { useMemo } from 'react';
import { useMarketStore, selectMetrics, selectDataConfidence } from '../../../store/marketStore';
import { useTradingStore } from '../../../store/tradingStore';
import { useWalletStore } from '../../../store/walletStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../../store/watchlistStore';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { RiskRibbon } from '../../RiskRibbon';
import { formatPrice } from '../../../services/marketDataService';
import styles from './TradeOverview.module.css';

interface TradeOverviewProps {
  onTradeClick?: (side: 'buy' | 'sell') => void;
}

export function TradeOverview({ onTradeClick }: TradeOverviewProps) {
  const { t } = useI18n();
  const metrics = useMarketStore(selectMetrics);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const positions = useTradingStore((state) => state.positions);
  const balances = useWalletStore((state) => state.balances);

  const baseAsset = selectedSymbol.replace('USDT', '');
  const currentPosition = positions.get(selectedSymbol);

  // Metrics processing
  const displayMetrics = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: t.metrics?.midPrice || 'Mid', value: formatPrice(parseFloat(metrics.mid)) },
      { label: t.metrics?.spread || 'Spread', value: `${(metrics.spreadBps || 0).toFixed(2)} bps` },
      { label: t.metrics?.imbalance || 'Imbalance', value: `${((metrics.bidAskImbalance || 0) * 100).toFixed(1)}%`, 
        trend: (metrics.bidAskImbalance || 0) > 0.1 ? 'up' : (metrics.bidAskImbalance || 0) < -0.1 ? 'down' : 'neutral' },
      { label: t.metrics?.volatility || 'Volatility', value: (metrics.microVolatility || 0).toFixed(4) },
      { label: t.metrics?.liquidityScore || 'Liquidity', value: `${(metrics.liquidityScore || 0).toFixed(0)}/100` },
      { label: t.metrics?.slippageEst || 'Slippage', value: metrics.slippageEst === 'N/A' ? 'N/A' : `${metrics.slippageEst} bps` },
    ];
  }, [metrics, t]);

  // Position processing
  const positionInfo = useMemo(() => {
    if (!currentPosition || !metrics?.mid) return null;
    const currentPrice = parseFloat(metrics.mid);
    const avgEntryPrice = parseFloat(currentPosition.avgEntryPrice);
    const qty = parseFloat(currentPosition.quantity);
    if (qty <= 0) return null;

    const pnl = (currentPrice - avgEntryPrice) * qty;
    const pnlPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
    
    return {
      qty,
      avgEntryPrice,
      currentPrice,
      pnl,
      pnlPercent,
      value: qty * currentPrice,
    };
  }, [currentPosition, metrics?.mid]);

  return (
    <div className={styles.container}>
      {/* 1. Market Status & Metrics */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.titleGroup}>
            <Icon name="activity" size="sm" />
            <h3 className={styles.sectionTitle}>{t.metrics?.title || 'Market Insights'}</h3>
          </div>
          {dataConfidence?.level !== 'live' && (
            <div className={`${styles.confidenceBadge} ${styles[dataConfidence?.level || 'stale']}`}>
              {dataConfidence?.level.toUpperCase()}
            </div>
          )}
        </div>
        <div className={styles.metricsGrid}>
          {displayMetrics.map((m, i) => (
            <div key={i} className={styles.metricItem}>
              <span className={styles.metricLabel}>{m.label}</span>
              <span className={`${styles.metricValue} ${m.trend ? styles[m.trend] : ''}`}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Current Position Card */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.titleGroup}>
            <Icon name="pie-chart" size="sm" />
            <h3 className={styles.sectionTitle}>{t.positions?.title || 'Current Position'}</h3>
          </div>
        </div>
        {positionInfo ? (
          <div className={`${styles.positionCard} ${positionInfo.pnl >= 0 ? styles.posUp : styles.posDown}`}>
            <div className={styles.posHeader}>
              <div className={styles.posSymbol}>
                <span className={styles.posBase}>{baseAsset}</span>
                <span className={styles.posSide}>LONG</span>
              </div>
              <div className={styles.posPnl}>
                <span className={styles.pnlVal}>
                  {positionInfo.pnl >= 0 ? '+' : ''}{positionInfo.pnl.toFixed(2)} USDT
                </span>
                <span className={styles.pnlPct}>
                  ({positionInfo.pnlPercent >= 0 ? '+' : ''}{positionInfo.pnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className={styles.posGrid}>
              <div className={styles.posItem}>
                <span className={styles.posLabel}>Size</span>
                <span className={styles.posValue}>{positionInfo.qty.toFixed(4)} {baseAsset}</span>
              </div>
              <div className={styles.posItem}>
                <span className={styles.posLabel}>Entry Price</span>
                <span className={styles.posValue}>${positionInfo.avgEntryPrice.toFixed(2)}</span>
              </div>
              <div className={styles.posItem}>
                <span className={styles.posLabel}>Market Value</span>
                <span className={styles.posValue}>${positionInfo.value.toFixed(2)}</span>
              </div>
              <div className={styles.posItem}>
                <span className={styles.posLabel}>Mark Price</span>
                <span className={styles.posValue}>${positionInfo.currentPrice.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.posActions}>
              <button className={styles.posActionBtn} onClick={() => onTradeClick?.('buy')}>
                <Icon name="edit" size="sm" />
                {t.common?.edit || 'Adjust'}
              </button>
              <button 
                className={`${styles.posActionBtn} ${styles.marketClose}`} 
                onClick={() => onTradeClick?.('sell')}
              >
                <Icon name="zap" size="sm" />
                {t.positions?.closeAll || 'Market Close'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>{t.positions?.noPositions || 'No active position for this pair'}</p>
            <div className={styles.quickActions}>
              <button className={styles.quickBuy} onClick={() => onTradeClick?.('buy')}>
                {t.orderEntry?.buy || 'Buy'} {baseAsset}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Risk Summary */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.titleGroup}>
            <Icon name="shield" size="sm" />
            <h3 className={styles.sectionTitle}>{t.riskRibbon?.title || 'Risk Management'}</h3>
          </div>
        </div>
        <div className={styles.riskCard}>
          <RiskRibbon />
        </div>
      </section>

      {/* 4. Account Balance Quick View */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.titleGroup}>
            <Icon name="wallet" size="sm" />
            <h3 className={styles.sectionTitle}>{t.wallet?.accountOverview || 'Wallet'}</h3>
          </div>
        </div>
        <div className={styles.balanceInfo}>
          <div className={styles.balanceMain}>
            <span className={styles.balanceLabel}>{t.account?.available || 'Available USDT'}</span>
            <span className={styles.balanceValue}>
              ${(balances.find(b => b.asset === 'USDT')?.available || '0')}
            </span>
          </div>
          <div className={styles.balanceSub}>
            <span className={styles.balanceLabel}>{baseAsset} {t.account?.balance || 'Balance'}</span>
            <span className={styles.balanceValue}>
              {balances.find(b => b.asset === baseAsset)?.total || '0'} {baseAsset}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

