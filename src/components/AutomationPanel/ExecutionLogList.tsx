
import { useI18n } from '../../i18n';
import { useAutomationStore } from '../../store/automationStore';
import { Icon } from '../Icon';
import { ExecutionLog } from '../../types/automation';
import { formatTime } from '../../utils/timeFormat';
import styles from './ExecutionLogList.module.css';

interface ExecutionLogListProps {
  triggerId?: string;
}

export function ExecutionLogList({ triggerId }: ExecutionLogListProps) {
  const { t } = useI18n();
  const allLogs = useAutomationStore((state) => state.executionLogs);
  const triggers = useAutomationStore((state) => state.triggers);

  const filteredLogs = triggerId 
    ? allLogs.filter(log => log.triggerId === triggerId)
    : allLogs;

  if (filteredLogs.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Icon name="list" size="lg" />
        <span>{t.automation.hints.noLogs}</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {filteredLogs.map((log) => {
        const trigger = triggers.find(t => t.id === log.triggerId);
        return (
          <LogItem 
            key={log.id} 
            log={log} 
            symbol={trigger?.symbol || 'Unknown'} 
          />
        );
      })}
    </div>
  );
}

interface LogItemProps {
  log: ExecutionLog;
  symbol: string;
}

function LogItem({ log, symbol }: LogItemProps) {
  const { t } = useI18n();

  if (!t.automation || !t.automation.logDetails) {
    return <div className={styles.logItem}>ERROR: i18n_MISSING</div>;
  }

  const getResultText = (result: string) => {
    switch (result) {
      case 'success': return t.automation.logDetails.success;
      case 'failed': return t.automation.logDetails.failed;
      case 'blocked': return t.automation.logDetails.blocked;
      default: return result;
    }
  };

  const getErrorCodeText = (code: string) => {
    if (!t.automation.logDetails) return code;
    return (t.automation.logDetails as any)[code] || code;
  };

  return (
    <div className={`${styles.logItem} ${styles[log.result]}`}>
      <div className={styles.header}>
        <span className={styles.time}>{formatTime(log.firedAt, true)}</span>
        <span className={`${styles.result} ${styles[log.result]}`}>
          {getResultText(log.result)}
        </span>
      </div>

      <div className={styles.reason}>
        <strong>{symbol}</strong>: {log.confidenceReason || 'Trigger condition met'}
      </div>

      <div className={styles.details}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.automation.logDetails.price}:</span>
          <span>{parseFloat(log.observedPrice).toLocaleString()}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.automation.logDetails.latency}:</span>
          <span>{log.executionLatencyMs}ms</span>
        </div>
        {log.orderId && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{t.automation.logDetails.orderId}:</span>
            <span className={styles.orderLink}>{log.orderId.slice(0, 8)}</span>
          </div>
        )}
      </div>

      {log.errorMessage && (
        <div className={styles.errorMessage}>
          {log.errorCode ? `${getErrorCodeText(log.errorCode)}: ` : ''}
          {log.errorMessage}
        </div>
      )}
    </div>
  );
}

