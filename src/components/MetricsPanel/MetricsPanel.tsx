import { useState } from 'react';
import { useMarketStore, selectMetrics, selectOrderBook, selectDataConfidence, selectCanTrustMetrics } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import type { DataConfidenceLevel } from '../../types/market';
import styles from './MetricsPanel.module.css';

interface MetricItemProps {
  label: string;
  value: string | number;
  unit?: string;
  tooltip?: string;
  colorClass?: string;
  isUncertain?: boolean;  // 是否受可信度影响
  confidenceLevel?: DataConfidenceLevel;
}

function MetricItem({ label, value, unit, tooltip, colorClass, isUncertain, confidenceLevel }: MetricItemProps) {
  const { t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);
  
  // 根据可信度决定显示方式
  const shouldDim = isUncertain && confidenceLevel && confidenceLevel !== 'live';
  const showUncertainIcon = shouldDim && (confidenceLevel === 'degraded' || confidenceLevel === 'resyncing');

  return (
    <div 
      className={`${styles.metricItem} ${shouldDim ? styles.uncertain : ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {showUncertainIcon && (
          <span className={styles.uncertainIcon} title={t.dataConfidence.metricsUncertain}>
            ?
          </span>
        )}
        {tooltip && (
          <button className={styles.infoBtn} aria-label={t.common.info || 'Info'}>
            <Icon name="info" size="xs" />
          </button>
        )}
      </div>
      <div className={styles.valueRow}>
        <span className={`${styles.value} ${colorClass ?? ''} tabular-nums`}>
          {confidenceLevel === 'stale' && isUncertain ? '—' : value}
        </span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      
      {showTooltip && tooltip && (
        <div className={styles.tooltip}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

export function MetricsPanel() {
  const { t } = useI18n();
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const canTrustMetrics = useMarketStore(selectCanTrustMetrics);
  
  const { level } = dataConfidence;

  if (!metrics || !orderBook) {
    return (
      <div className={`card ${styles.container}`}>
        <div className="card-header">{t.metrics.title}</div>
        <div className={`card-body ${styles.loading}`}>
          <span>{t.common.loading}</span>
        </div>
      </div>
    );
  }

  const imbalanceClass = metrics.bidAskImbalance > 0.1 
    ? 'price-up' 
    : metrics.bidAskImbalance < -0.1 
      ? 'price-down' 
      : '';

  const liquidityClass = metrics.liquidityScore >= 70 
    ? 'price-up' 
    : metrics.liquidityScore <= 30 
      ? 'price-down' 
      : '';

  return (
    <div className={`card ${styles.container} ${!canTrustMetrics ? styles.degraded : ''}`}>
      <div className="card-header">
        <span>{t.metrics.title}</span>
        {!canTrustMetrics && (
          <span className={`${styles.confidenceBadge} ${styles[level]}`} title={dataConfidence.reason}>
            <Icon name={level === 'stale' ? 'pause' : 'zap'} size="sm" />
          </span>
        )}
      </div>
      
      <div className={styles.grid}>
        <MetricItem
          label={t.metrics.midPrice}
          value={formatPrice(metrics.mid)}
          tooltip={t.metrics.midPriceDesc}
          isUncertain={true}
          confidenceLevel={level}
        />
        
        <MetricItem
          label={t.metrics.spread}
          value={metrics.spreadBps.toFixed(2)}
          unit={t.orderBook.spreadBps}
          tooltip={t.metrics.spreadDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics.imbalance}
          value={(metrics.bidAskImbalance * 100).toFixed(1)}
          unit="%"
          colorClass={imbalanceClass}
          tooltip={t.metrics.imbalanceDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics.volatility}
          value={metrics.microVolatility.toFixed(4)}
          tooltip={t.metrics.volatilityDesc}
          isUncertain={false}  // 基于历史数据，部分可信
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics.tradeIntensity}
          value={metrics.tradeIntensity}
          unit="/10s"
          tooltip={t.metrics.tradeIntensityDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics.vwap}
          value={formatPrice(metrics.vwap60s)}
          tooltip={t.metrics.vwapDesc}
          isUncertain={false}  // 基于历史数据，部分可信
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics.liquidityScore}
          value={metrics.liquidityScore.toFixed(0)}
          unit="/100"
          colorClass={liquidityClass}
          tooltip={t.metrics.liquidityScoreDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics.slippageEst}
          value={metrics.slippageEst === 'N/A' ? 'N/A' : `${metrics.slippageEst}`}
          unit={metrics.slippageEst === 'N/A' ? '' : t.orderBook.spreadBps}
          tooltip={t.metrics.slippageEstDesc}
          isUncertain={true}
          confidenceLevel={level}
        />
      </div>

      <div className={styles.depthInfo}>
        <span className={styles.depthLabel}>{t.orderBook.depthLevels}:</span>
        <span className={`${styles.depthValue} tabular-nums`}>
          {orderBook.depth}
        </span>
        <span className={styles.depthLabel}>{t.dataConfidence.lastUpdate}:</span>
        <span className={`${styles.depthValue} tabular-nums`}>
          {new Date(orderBook.localUpdateTime).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num === 0) return '—';
  if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(8);
}
