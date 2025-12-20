import { useState, useEffect } from 'react';
import { useMarketStore, selectConnectionStatus, selectDataConfidence } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { formatLastUpdateTime } from '../../utils/timeFormat';
import { DiagnosticsDrawer } from './DiagnosticsDrawer';
import { Icon } from '../Icon';
import styles from './DataConfidenceBar.module.css';

export function DataConfidenceBar() {
  const { t } = useI18n();
  const connectionStatus = useMarketStore(selectConnectionStatus);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const [showDrawer, setShowDrawer] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');

  const { level, reason } = dataConfidence;

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

  const getStatusText = () => {
    switch (level) {
      case 'live': return t.dataConfidence.live;
      case 'degraded': return t.dataConfidence.degraded;
      case 'resyncing': return t.dataConfidence.resyncing;
      case 'stale': return t.dataConfidence.stale;
      default: return '';
    }
  };

  const getLatencyDisplay = () => {
    if (connectionStatus.state !== 'connected') return '—';
    if (connectionStatus.latencyMs < 1) return '<1ms';
    return `${Math.round(connectionStatus.latencyMs)}ms`;
  };

  return (
    <>
      <div className={`${styles.bar} ${styles[level]} animate-fade`}>
        <div className={styles.statusSection}>
          <div className={styles.statusInfo}>
            <span className={styles.statusText}>{getStatusText()}</span>
            {reason && <span className={styles.statusReason}>{reason}</span>}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.metricsSection}>
          <div className={styles.metric}>
            <Icon name="clock" size="xs" className={styles.metricIcon} />
            <span className="tabular-nums">{lastUpdateTime}</span>
          </div>
          <div className={styles.metric}>
            <Icon name="zap" size="xs" className={styles.metricIcon} />
            <span className="tabular-nums">{getLatencyDisplay()}</span>
          </div>
          <div className={styles.metric}>
            <Icon name="bar-chart-2" size="xs" className={styles.metricIcon} />
            <span className="tabular-nums">{connectionStatus.messageRate}/s</span>
          </div>
        </div>

        <button
          className={styles.diagnosticsBtn}
          onClick={() => setShowDrawer(true)}
          title={t.dataConfidence.diagnostics}
        >
          <Icon name="info" size="sm" />
        </button>
      </div>

      <DiagnosticsDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} />
    </>
  );
}
