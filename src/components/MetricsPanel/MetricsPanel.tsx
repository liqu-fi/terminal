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

interface MetricsPanelProps {
  compact?: boolean;
}

export function MetricsPanel({ compact = false }: MetricsPanelProps) {
  const { t } = useI18n();
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const canTrustMetrics = useMarketStore(selectCanTrustMetrics);
  
  const level = dataConfidence?.level || 'stale';

  if (!metrics || !orderBook) {
    return compact ? null : (
      <div className={`card ${styles.container}`}>
        <div className="card-header">{t.metrics?.title || 'Metrics'}</div>
        <div className={`card-body ${styles.loading}`}>
          <span>{t.common?.loading || 'Loading...'}</span>
        </div>
      </div>
    );
  }

  const imbalanceClass = (metrics.bidAskImbalance || 0) > 0.1 
    ? 'price-up' 
    : (metrics.bidAskImbalance || 0) < -0.1 
      ? 'price-down' 
      : '';

  const liquidityClass = (metrics.liquidityScore || 0) >= 70 
    ? 'price-up' 
    : (metrics.liquidityScore || 0) <= 30 
      ? 'price-down' 
      : '';

  // Compact mode for mobile - horizontal strip
  if (compact) {
    return (
      <div className={styles.compactContainer}>
        <span className={styles.compactMetric}>
          <span className={styles.compactLabel}>Mid</span>
          <span className={styles.compactValue}>{formatPrice(metrics.mid)}</span>
        </span>
        <span className={styles.compactDivider}>|</span>
        <span className={styles.compactMetric}>
          <span className={styles.compactLabel}>Spread</span>
          <span className={styles.compactValue}>{(metrics.spreadBps || 0).toFixed(1)} bps</span>
        </span>
        <span className={styles.compactDivider}>|</span>
        <span className={styles.compactMetric}>
          <span className={styles.compactLabel}>Vol</span>
          <span className={styles.compactValue}>{formatVolume(parseFloat(metrics.bidDepthVolume) + parseFloat(metrics.askDepthVolume))}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`card ${styles.container} ${!canTrustMetrics ? styles.degraded : ''}`}>
      <div className="card-header">
        <span>{t.metrics?.title || 'Metrics'}</span>
        {!canTrustMetrics && (
          <span className={`${styles.confidenceBadge} ${styles[level]}`} title={dataConfidence?.reason}>
            <Icon name={level === 'stale' ? 'pause' : 'zap'} size="sm" />
          </span>
        )}
      </div>
      
      <div className={styles.grid}>
        <MetricItem
          label={t.metrics?.midPrice || 'Mid Price'}
          value={formatPrice(metrics.mid)}
          tooltip={t.metrics?.midPriceDesc}
          isUncertain={true}
          confidenceLevel={level}
        />
        
        <MetricItem
          label={t.metrics?.spread || 'Spread'}
          value={(metrics.spreadBps || 0).toFixed(2)}
          unit={t.orderBook?.spreadBps || 'bps'}
          tooltip={t.metrics?.spreadDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics?.imbalance || 'Imbalance'}
          value={((metrics.bidAskImbalance || 0) * 100).toFixed(1)}
          unit="%"
          colorClass={imbalanceClass}
          tooltip={t.metrics?.imbalanceDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics?.volatility || 'Volatility'}
          value={(metrics.microVolatility || 0).toFixed(4)}
          tooltip={t.metrics?.volatilityDesc}
          isUncertain={false}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics?.tradeIntensity || 'Intensity'}
          value={metrics.tradeIntensity || 0}
          unit="/10s"
          tooltip={t.metrics?.tradeIntensityDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics?.vwap || 'VWAP'}
          value={formatPrice(metrics.vwap60s)}
          tooltip={t.metrics?.vwapDesc}
          isUncertain={false}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics?.liquidityScore || 'Liquidity'}
          value={(metrics.liquidityScore || 0).toFixed(0)}
          unit="/100"
          colorClass={liquidityClass}
          tooltip={t.metrics?.liquidityScoreDesc}
          isUncertain={true}
          confidenceLevel={level}
        />

        <MetricItem
          label={t.metrics?.slippageEst || 'Slippage'}
          value={metrics.slippageEst === 'N/A' ? 'N/A' : `${metrics.slippageEst}`}
          unit={metrics.slippageEst === 'N/A' ? '' : (t.orderBook?.spreadBps || 'bps')}
          tooltip={t.metrics?.slippageEstDesc}
          isUncertain={true}
          confidenceLevel={level}
        />
      </div>

      <div className={styles.depthInfo}>
        <span className={styles.depthLabel}>{t.orderBook?.depthLevels || 'Depth'}:</span>
        <span className={`${styles.depthValue} tabular-nums`}>
          {orderBook.depth || 0}
        </span>
        <span className={styles.depthLabel}>{t.dataConfidence?.lastUpdate || 'Update'}:</span>
        <span className={`${styles.depthValue} tabular-nums`}>
          {new Date(orderBook.localUpdateTime || Date.now()).toLocaleTimeString()}
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

function formatVolume(volume: number): string {
  if (volume >= 1e9) return (volume / 1e9).toFixed(1) + 'B';
  if (volume >= 1e6) return (volume / 1e6).toFixed(1) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(1) + 'K';
  return volume.toFixed(0);
}
