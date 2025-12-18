import { useState, useEffect } from 'react';
import { useMarketStore, selectConnectionStatus, selectDataConfidence, selectMetrics } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { formatLastUpdateTime } from '../../utils/timeFormat';
import { DiagnosticsDrawer } from './DiagnosticsDrawer';
import type { DataConfidenceLevel } from '../../types/market';
import styles from './DataConfidenceBar.module.css';

// 状态图标组件
function StatusIcon({ level }: { level: DataConfidenceLevel }) {
  switch (level) {
    case 'live':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="4" fill="currentColor" />
          <circle cx="8" cy="8" r="7" fill="none" opacity="0.3" />
        </svg>
      );
    case 'degraded':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1l7 14H1L8 1z" />
          <circle cx="8" cy="11" r="1" fill="currentColor" />
          <rect x="7.25" y="5" width="1.5" height="4" rx="0.75" fill="currentColor" />
        </svg>
      );
    case 'resyncing':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.spinning}>
          <path d="M8 1a7 7 0 106.32 4H12.5a5.5 5.5 0 10.5 3h1.5A7 7 0 018 1z" />
        </svg>
      );
    case 'stale':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="7" />
          <path d="M5 5l6 6M11 5l-6 6" />
        </svg>
      );
  }
}

export function DataConfidenceBar() {
  const { t } = useI18n();
  const connectionStatus = useMarketStore(selectConnectionStatus);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const metrics = useMarketStore(selectMetrics);
  const [showDrawer, setShowDrawer] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');

  const { level, reason } = dataConfidence;

  // 更新相对时间显示（每 1s 刷新）
  useEffect(() => {
    if (connectionStatus.lastMessageTime > 0) {
      const updateTime = () => {
        setLastUpdateTime(formatLastUpdateTime(connectionStatus.lastMessageTime));
      };
      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    } else {
      setLastUpdateTime('—');
    }
  }, [connectionStatus.lastMessageTime]);

  // 获取状态文本
  const getStatusText = () => {
    switch (level) {
      case 'live': return t.dataConfidence.live;
      case 'degraded': return t.dataConfidence.degraded;
      case 'resyncing': return t.dataConfidence.resyncing;
      case 'stale': return t.dataConfidence.stale;
    }
  };

  const getLatencyDisplay = () => {
    if (connectionStatus.state !== 'connected') return '—';
    if (connectionStatus.latencyMs < 1) return '<1ms';
    return `${Math.round(connectionStatus.latencyMs)}ms`;
  };

  return (
    <>
      <div className={`${styles.bar} ${styles[level]}`}>
        {/* 左区：状态指示 */}
        <div className={styles.statusSection}>
          <div className={`${styles.statusIcon} ${styles[level]}`}>
            <StatusIcon level={level} />
          </div>
          <div className={styles.statusInfo}>
            <span className={styles.statusText}>{getStatusText()}</span>
            <span className={styles.statusReason} title={reason}>{reason}</span>
          </div>
        </div>

        {/* 中区：Last Trusted Update */}
        <div className={styles.updateSection}>
          <span className={`${styles.updateTime} tabular-nums`}>
            {lastUpdateTime || '—'}
          </span>
        </div>

        {/* 右区：快速指标 + 控制 */}
        <div className={styles.metricsSection}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t.dataConfidence.latency}</span>
            <span className={`${styles.metricValue} tabular-nums`}>{getLatencyDisplay()}</span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t.dataConfidence.messageRate}</span>
            <span className={`${styles.metricValue} tabular-nums`}>
              {connectionStatus.messageRate}/s
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t.dataConfidence.provider}</span>
            <span className={styles.metricValue}>Binance</span>
          </div>

          <button
            className={styles.diagnosticsBtn}
            onClick={() => setShowDrawer(true)}
            aria-label={t.dataConfidence.diagnostics}
            title={t.dataConfidence.diagnostics}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 11h.01" />
            </svg>
          </button>
        </div>
      </div>

      {/* 诊断抽屉 */}
      <DiagnosticsDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} />
    </>
  );
}
