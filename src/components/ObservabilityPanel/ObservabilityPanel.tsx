import { useState, useMemo } from 'react';
import { useMarketStore, selectConnectionStatus, selectDataConfidence, selectLogs } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './ObservabilityPanel.module.css';

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  event: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

function LogItem({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  
  const levelClass = {
    debug: styles.debug,
    info: styles.info,
    warn: styles.warn,
    error: styles.error,
  }[log.level];

  const levelIconMap = {
    debug: 'search' as const,
    info: 'info' as const,
    warn: 'alert-triangle' as const,
    error: 'x' as const,
  };

  return (
    <div 
      className={`${styles.logItem} ${levelClass}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={styles.logHeader}>
        <span className={styles.logIcon}>
          <Icon name={levelIconMap[log.level]} size="sm" />
        </span>
        <span className={styles.logCategory}>[{log.category}]</span>
        <span className={styles.logEvent}>{log.event}</span>
        {log.timestamp && (
          <span className={`${styles.logTime} tabular-nums`}>
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
      {expanded && Object.keys(log.data).length > 0 && (
        <pre className={styles.logData}>
          {JSON.stringify(log.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function ObservabilityPanel() {
  const { t } = useI18n();
  const connectionStatus = useMarketStore(selectConnectionStatus);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const logs = useMarketStore(selectLogs);
  const clearLogs = useMarketStore((state) => state.clearLogs);
  
  const [activeTab, setActiveTab] = useState<'metrics' | 'logs'>('metrics');
  const [logFilter, setLogFilter] = useState<'all' | 'warn' | 'error'>('all');

  // 计算会话统计
  const sessionStats = useMemo(() => {
    const now = Date.now();
    const sessionDuration = connectionStatus.lastMessageTime > 0 
      ? Math.round((now - (connectionStatus.lastMessageTime - 60000)) / 1000 / 60)
      : 0;
    
    const livePercentage = dataConfidence.lastLiveTime > 0 && dataConfidence.degradedSince > 0
      ? Math.round(((now - dataConfidence.degradedSince) / (now - dataConfidence.lastLiveTime)) * 100)
      : dataConfidence.level === 'live' ? 100 : 0;

    return {
      sessionDuration,
      livePercentage,
      totalGaps: connectionStatus.gapCount,
      totalResyncs: connectionStatus.resyncCount,
      totalReconnects: connectionStatus.reconnectCount,
      avgLatency: connectionStatus.latencyMs,
    };
  }, [connectionStatus, dataConfidence]);

  // 过滤日志
  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    if (logFilter === 'warn') return logs.filter(l => l.level === 'warn' || l.level === 'error');
    return logs.filter(l => l.level === 'error');
  }, [logs, logFilter]);

  return (
    <div className={`card ${styles.container}`}>
      <div className={`card-header ${styles.header}`}>
        <span>
          <Icon name="activity" size="sm" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          {t.observability?.title || 'Observability'}
        </span>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'metrics' ? styles.active : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            {t.observability?.metrics || 'Metrics'}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            {t.observability?.logs || 'Logs'} ({logs.length})
          </button>
        </div>
      </div>

      {activeTab === 'metrics' ? (
        <div className={styles.metricsContent}>
          {/* 系统健康概览 */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{t.observability?.systemHealth || 'System Health'}</h4>
            <div className={styles.healthGrid}>
              <div className={`${styles.healthItem} ${connectionStatus.state === 'connected' ? styles.healthy : styles.unhealthy}`}>
                <span className={styles.healthIcon}>
                  <Icon name={connectionStatus.state === 'connected' ? 'check' : 'x'} size="sm" />
                </span>
                <span>{t.observability?.wsConnection || 'WebSocket Connection'}</span>
              </div>
              <div className={`${styles.healthItem} ${dataConfidence.details.sequenceContinuous ? styles.healthy : styles.unhealthy}`}>
                <span className={styles.healthIcon}>
                  <Icon name={dataConfidence.details.sequenceContinuous ? 'check' : 'x'} size="sm" />
                </span>
                <span>{t.observability?.sequenceCheck || 'Sequence Check'}</span>
              </div>
              <div className={`${styles.healthItem} ${dataConfidence.details.latencyOk ? styles.healthy : styles.unhealthy}`}>
                <span className={styles.healthIcon}>
                  <Icon name={dataConfidence.details.latencyOk ? 'check' : 'x'} size="sm" />
                </span>
                <span>{t.observability?.latencyCheck || 'Latency Check'}</span>
              </div>
              <div className={`${styles.healthItem} ${dataConfidence.details.updateFrequencyOk ? styles.healthy : styles.unhealthy}`}>
                <span className={styles.healthIcon}>
                  <Icon name={dataConfidence.details.updateFrequencyOk ? 'check' : 'x'} size="sm" />
                </span>
                <span>{t.observability?.updateFrequency || 'Update Frequency'}</span>
              </div>
            </div>
          </div>

          {/* 会话统计 */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{t.observability?.sessionStats || 'Session Statistics'}</h4>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.observability?.latency || 'Latency'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {connectionStatus.latencyMs.toFixed(0)}ms
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.observability?.messageRate || 'Message Rate'}</span>
                <span className={`${styles.statValue} tabular-nums`}>
                  {connectionStatus.messageRate}/s
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.observability?.gapCount || 'Gaps'}</span>
                <span className={`${styles.statValue} tabular-nums ${sessionStats.totalGaps > 0 ? styles.warning : ''}`}>
                  {sessionStats.totalGaps}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.observability?.resyncCount || 'Resyncs'}</span>
                <span className={`${styles.statValue} tabular-nums ${sessionStats.totalResyncs > 0 ? styles.warning : ''}`}>
                  {sessionStats.totalResyncs}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.observability?.reconnectCount || 'Reconnects'}</span>
                <span className={`${styles.statValue} tabular-nums ${sessionStats.totalReconnects > 0 ? styles.warning : ''}`}>
                  {sessionStats.totalReconnects}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t.observability?.confidence || 'Confidence'}</span>
                <span className={`${styles.statValue} ${styles[dataConfidence.level]}`}>
                  {dataConfidence.level.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className={styles.logsContent}>
          {/* 日志过滤器 */}
          <div className={styles.logFilters}>
            <button
              className={`${styles.filterBtn} ${logFilter === 'all' ? styles.active : ''}`}
              onClick={() => setLogFilter('all')}
            >
              {t.observability?.all || 'All'}
            </button>
            <button
              className={`${styles.filterBtn} ${logFilter === 'warn' ? styles.active : ''}`}
              onClick={() => setLogFilter('warn')}
            >
              {t.observability?.warnPlus || 'Warn+'}
            </button>
            <button
              className={`${styles.filterBtn} ${logFilter === 'error' ? styles.active : ''}`}
              onClick={() => setLogFilter('error')}
            >
              {t.observability?.error || 'Error'}
            </button>
            <button
              className={styles.clearBtn}
              onClick={clearLogs}
            >
              {t.observability?.clear || 'Clear'}
            </button>
          </div>

          {/* 日志列表 */}
          <div className={styles.logList}>
            {filteredLogs.length === 0 ? (
              <div className={styles.emptyLogs}>
                {t.observability?.noLogs || 'No logs'}
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <LogItem key={i} log={log as LogEntry} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

