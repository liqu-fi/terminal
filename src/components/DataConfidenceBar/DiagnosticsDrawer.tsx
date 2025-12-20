import { useMarketStore, selectConnectionStatus, selectDataConfidence, selectNetworkHealth } from '../../store/marketStore';
import { useI18n, type Locale } from '../../i18n';
import { Icon } from '../Icon';
import type { NetworkEvent, NetworkEventType } from '../../types/market';
import styles from './DiagnosticsDrawer.module.css';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// 检查项组件
function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  const { t } = useI18n();
  return (
    <div className={styles.checkItem}>
      <span className={`${styles.checkIcon} ${passed ? styles.passed : styles.failed}`}>
        <Icon name={passed ? 'check' : 'x'} size="sm" />
      </span>
      <span className={styles.checkLabel}>{label}</span>
      <span className={`${styles.checkStatus} ${passed ? styles.passed : styles.failed}`}>
        {passed ? t.dataConfidence.passed : t.dataConfidence.failed}
      </span>
    </div>
  );
}

// 网络事件图标
function NetworkEventIcon({ type }: { type: NetworkEventType }) {
  switch (type) {
    case 'connected':
      return <Icon name="wifi" size="sm" />;
    case 'disconnected':
      return <Icon name="wifi-off" size="sm" />;
    case 'reconnecting':
      return <Icon name="refresh-cw" size="sm" />;
    case 'latency_spike':
      return <Icon name="trending-up" size="sm" />;
    case 'latency_normal':
      return <Icon name="trending-down" size="sm" />;
    case 'gap_detected':
      return <Icon name="alert-triangle" size="sm" />;
    case 'resync_start':
      return <Icon name="download" size="sm" />;
    case 'resync_complete':
      return <Icon name="check-circle" size="sm" />;
    case 'rate_drop':
      return <Icon name="arrow-down" size="sm" />;
    case 'rate_normal':
      return <Icon name="arrow-up" size="sm" />;
    default:
      return <Icon name="circle" size="sm" />;
  }
}

// 获取事件类型的样式类
function getEventClass(type: NetworkEventType): string {
  switch (type) {
    case 'connected':
    case 'resync_complete':
    case 'latency_normal':
    case 'rate_normal':
      return styles.eventGood || '';
    case 'disconnected':
    case 'latency_spike':
    case 'gap_detected':
    case 'rate_drop':
      return styles.eventBad || '';
    case 'reconnecting':
    case 'resync_start':
      return styles.eventWarning || '';
    default:
      return '';
  }
}

// 获取事件类型的显示名称
function getEventTypeName(type: NetworkEventType, t: Locale): string {
  const names: Record<NetworkEventType, string> = {
    connected: (t as any).networkHealth?.events?.connected || 'Connected',
    disconnected: (t as any).networkHealth?.events?.disconnected || 'Disconnected',
    reconnecting: (t as any).networkHealth?.events?.reconnecting || 'Reconnecting',
    latency_spike: (t as any).networkHealth?.events?.latencySpike || 'Latency Spike',
    latency_normal: (t as any).networkHealth?.events?.latencyNormal || 'Latency Normal',
    gap_detected: (t as any).networkHealth?.events?.gapDetected || 'Gap Detected',
    resync_start: (t as any).networkHealth?.events?.resyncStart || 'Resync Started',
    resync_complete: (t as any).networkHealth?.events?.resyncComplete || 'Resync Complete',
    rate_drop: (t as any).networkHealth?.events?.rateDrop || 'Rate Drop',
    rate_normal: (t as any).networkHealth?.events?.rateNormal || 'Rate Normal',
  };
  return names[type] || type;
}

// 时间线事件组件
function NetworkEventItem({ event }: { event: NetworkEvent }) {
  const { t } = useI18n();
  
  return (
    <div className={`${styles.timelineEvent} ${getEventClass(event.type)}`}>
      <div className={styles.timelineTime}>
        {new Date(event.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </div>
      <div className={styles.timelineIcon}>
        <NetworkEventIcon type={event.type} />
      </div>
      <div className={styles.timelineContent}>
        <span className={styles.timelineLevel}>{getEventTypeName(event.type, t)}</span>
        {event.details && <span className={styles.timelineReason}>{event.details}</span>}
      </div>
    </div>
  );
}

// 网络评分仪表
function NetworkScoreGauge({ score, trend }: { score: number; trend: 'improving' | 'stable' | 'degrading' }) {
  const { t } = useI18n();
  
  const getScoreColor = () => {
    if (score >= 80) return styles.scoreExcellent;
    if (score >= 60) return styles.scoreGood;
    if (score >= 40) return styles.scoreFair;
    return styles.scorePoor;
  };
  
  const getScoreLabel = () => {
    if (score >= 80) return t.networkHealth?.excellent || 'Excellent';
    if (score >= 60) return t.networkHealth?.good || 'Good';
    if (score >= 40) return t.networkHealth?.fair || 'Fair';
    return t.networkHealth?.poor || 'Poor';
  };
  
  const getTrendIcon = () => {
    switch (trend) {
      case 'improving': return <Icon name="trending-up" size="sm" />;
      case 'degrading': return <Icon name="trending-down" size="sm" />;
      default: return <Icon name="minus" size="sm" />;
    }
  };
  
  return (
    <div className={styles.scoreGauge}>
      <div className={`${styles.scoreCircle} ${getScoreColor()}`}>
        <span className={styles.scoreValue}>{score}</span>
        <span className={styles.scoreMax}>/100</span>
      </div>
      <div className={styles.scoreInfo}>
        <span className={styles.scoreLabel}>{getScoreLabel()}</span>
        <span className={`${styles.scoreTrend} ${styles[trend]}`}>
          {getTrendIcon()}
          {t.networkHealth?.[trend] || trend}
        </span>
      </div>
    </div>
  );
}

export function DiagnosticsDrawer({ isOpen, onClose }: DiagnosticsDrawerProps) {
  const { t } = useI18n();
  const connectionStatus = useMarketStore(selectConnectionStatus);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const networkHealth = useMarketStore(selectNetworkHealth);
  const subscribe = useMarketStore((state) => state.subscribe);
  const orderBook = useMarketStore((state) => state.orderBook);

  const handleReconnect = () => {
    if (orderBook?.symbol) {
      subscribe(orderBook.symbol);
    }
    onClose();
  };

  const handleForceResync = () => {
    if (orderBook?.symbol) {
      subscribe(orderBook.symbol);
    }
    onClose();
  };

  if (!isOpen) return null;

  // 格式化运行时间
  const formatUptime = (startTime: number) => {
    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t.dataConfidence.diagnostics}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t.common.close}>
            <Icon name="x" size="sm" />
          </button>
        </div>

        <div className={styles.content}>
          {/* 网络健康评分 */}
          {networkHealth && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>{t.networkHealth?.title || 'Network Health'}</h4>
              <NetworkScoreGauge score={networkHealth.score} trend={networkHealth.trend} />
              
              {/* 分项评分 */}
              <div className={styles.scoreBreakdown}>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreItemLabel}>{t.networkHealth?.latencyScore || 'Latency'}</span>
                  <div className={styles.scoreBar}>
                    <div 
                      className={styles.scoreBarFill} 
                      style={{ width: `${(networkHealth.scoreComponents.latency / 30) * 100}%` }}
                    />
                  </div>
                  <span className={styles.scoreItemValue}>{networkHealth.scoreComponents.latency}/30</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreItemLabel}>{t.networkHealth?.stabilityScore || 'Stability'}</span>
                  <div className={styles.scoreBar}>
                    <div 
                      className={styles.scoreBarFill} 
                      style={{ width: `${(networkHealth.scoreComponents.stability / 30) * 100}%` }}
                    />
                  </div>
                  <span className={styles.scoreItemValue}>{networkHealth.scoreComponents.stability}/30</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreItemLabel}>{t.networkHealth?.throughputScore || 'Throughput'}</span>
                  <div className={styles.scoreBar}>
                    <div 
                      className={styles.scoreBarFill} 
                      style={{ width: `${(networkHealth.scoreComponents.throughput / 20) * 100}%` }}
                    />
                  </div>
                  <span className={styles.scoreItemValue}>{networkHealth.scoreComponents.throughput}/20</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreItemLabel}>{t.networkHealth?.reliabilityScore || 'Reliability'}</span>
                  <div className={styles.scoreBar}>
                    <div 
                      className={styles.scoreBarFill} 
                      style={{ width: `${(networkHealth.scoreComponents.reliability / 20) * 100}%` }}
                    />
                  </div>
                  <span className={styles.scoreItemValue}>{networkHealth.scoreComponents.reliability}/20</span>
                </div>
              </div>
            </div>
          )}

          {/* 系统健康检查 */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{t.dataConfidence.systemStatus}</h4>
            <div className={styles.checksGrid}>
              <CheckItem label={t.dataConfidence.wsConnection} passed={dataConfidence.details.wsConnected} />
              <CheckItem label={t.dataConfidence.sequenceCheck} passed={dataConfidence.details.sequenceContinuous} />
              <CheckItem label={t.dataConfidence.latencyCheck} passed={dataConfidence.details.latencyOk} />
              <CheckItem label={t.dataConfidence.updateFrequency} passed={dataConfidence.details.updateFrequencyOk} />
              <CheckItem label={t.dataConfidence.queueHealth} passed={dataConfidence.details.queueHealthy} />
            </div>
          </div>

          {/* 会话统计 - 增强版 */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{t.dataConfidence.sessionStats}</h4>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.networkHealth?.sessionDuration || 'Session'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.sessionStartTime 
                    ? formatUptime(networkHealth.stats.sessionStartTime) 
                    : '—'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.networkHealth?.uptime || 'Uptime'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.uptimePercent 
                    ? `${networkHealth.stats.uptimePercent.toFixed(1)}%` 
                    : '—'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.dataConfidence.reconnectCount}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.totalReconnects ?? connectionStatus.reconnectCount}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.dataConfidence.gapCount}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.totalGaps ?? connectionStatus.gapCount}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.networkHealth?.avgLatency || 'Avg Latency'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.avgLatency 
                    ? `${Math.round(networkHealth.stats.avgLatency)}ms` 
                    : '—'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.networkHealth?.p95Latency || 'P95 Latency'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.latencyP95 
                    ? `${Math.round(networkHealth.stats.latencyP95)}ms` 
                    : '—'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.networkHealth?.minLatency || 'Min'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.minLatency 
                    ? `${Math.round(networkHealth.stats.minLatency)}ms` 
                    : '—'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.networkHealth?.maxLatency || 'Max'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {networkHealth?.stats.maxLatency 
                    ? `${Math.round(networkHealth.stats.maxLatency)}ms` 
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 事件时间线 */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{t.dataConfidence.truthTimeline}</h4>
            <div className={styles.timeline}>
              {networkHealth?.recentEvents && networkHealth.recentEvents.length > 0 ? (
                networkHealth.recentEvents.map((event, index) => (
                  <NetworkEventItem key={`${event.timestamp}-${index}`} event={event} />
                ))
              ) : (
                <div className={styles.emptyTimeline}>
                  {t.networkHealth?.noEvents || 'No events yet'}
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={handleReconnect}>
              {t.dataConfidence.reconnect}
            </button>
            <button className={styles.actionBtn} onClick={handleForceResync}>
              {t.dataConfidence.forceResync}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

