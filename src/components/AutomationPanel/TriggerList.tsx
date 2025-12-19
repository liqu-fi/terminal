import React from 'react';
import { useI18n } from '../../i18n';
import { useAutomationStore } from '../../store/automationStore';
import { Icon } from '../Icon';
import { Trigger, TriggerStatus } from '../../types/automation';
import { formatTime } from '../../utils/timeFormat';
import styles from './TriggerList.module.css';

interface TriggerListProps {
  filterSymbol?: string;
  showHistory?: boolean;
}

export function TriggerList({ filterSymbol, showHistory = false }: TriggerListProps) {
  const { t } = useI18n();
  const triggers = useAutomationStore((state) => state.triggers);
  const removeTrigger = useAutomationStore((state) => state.removeTrigger);
  const pauseTrigger = useAutomationStore((state) => state.pauseTrigger);
  const resumeTrigger = useAutomationStore((state) => state.resumeTrigger);

  const filteredTriggers = triggers.filter((t) => {
    const symbolMatch = !filterSymbol || t.symbol === filterSymbol;
    const historyMatch = showHistory 
      ? ['completed', 'failed', 'cancelled', 'expired'].includes(t.status)
      : ['armed', 'paused', 'blocked', 'triggered'].includes(t.status);
    return symbolMatch && historyMatch;
  });

  if (filteredTriggers.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Icon name="activity" size="lg" />
        <span>{showHistory ? t.automation.hints.noLogs : t.automation.hints.noTriggers}</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {filteredTriggers.map((trigger) => (
        <TriggerItem
          key={trigger.id}
          trigger={trigger}
          onDelete={() => removeTrigger(trigger.id)}
          onToggle={() => trigger.status === 'paused' ? resumeTrigger(trigger.id) : pauseTrigger(trigger.id)}
        />
      ))}
    </div>
  );
}

interface TriggerItemProps {
  trigger: Trigger;
  onDelete: () => void;
  onToggle: () => void;
}

function TriggerItem({ trigger, onDelete, onToggle }: TriggerItemProps) {
  const { t } = useI18n();

  // Defensive check for i18n sections
  const automationStrings = t.automation || {
    status: {},
    type: {},
    form: { buy: 'Buy', sell: 'Sell' }
  };

  const getStatusBadge = (status: TriggerStatus) => {
    const statusText = (automationStrings.status as any)[status] || status;
    return (
      <div className={`${styles.status} ${styles[`status-${status}`] || ''}`}>
        {['armed', 'paused', 'blocked', 'triggered'].includes(status) && (
          <div className={styles.statusDot} />
        )}
        <span>{statusText}</span>
      </div>
    );
  };

  const isBuy = trigger.action.side === 'buy';

  return (
    <div className={styles.triggerItem}>
      <div className={styles.header}>
        <div className={styles.symbolType}>
          <span className={styles.symbol}>{trigger.symbol}</span>
          <span className={styles.type}>{(automationStrings.type as any)[trigger.type] || trigger.type}</span>
        </div>
        {getStatusBadge(trigger.status)}
      </div>

      <div className={styles.content}>
        <div className={styles.condition}>
          <span>{trigger.condition.priceSource.toUpperCase()}</span>
          <Icon name={trigger.condition.operator === 'gte' ? 'arrow-up' : 'arrow-down'} size="xs" />
          <span>{parseFloat(trigger.condition.threshold).toLocaleString()}</span>
        </div>
        <div className={styles.action}>
          <span className={isBuy ? styles.buyText : styles.sellText}>
            {isBuy ? automationStrings.form.buy : automationStrings.form.sell}
          </span>
          {' '}
          <span>{trigger.action.orderType === 'market' ? t.orderEntry.market : t.orderEntry.limit}</span>
          {' '}
          <span>
            {trigger.action.quantityValue}
            {trigger.action.quantityMode === 'percent' ? '%' : ''}
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.time}>{formatTime(trigger.createdAt)}</span>
        <div className={styles.actions}>
          {['armed', 'paused', 'blocked'].includes(trigger.status) && (
            <button className={styles.actionBtn} onClick={onToggle} title={trigger.status === 'paused' ? 'Resume' : 'Pause'}>
              <Icon name={trigger.status === 'paused' ? 'play' : 'pause'} size="xs" />
            </button>
          )}
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Delete">
            <Icon name="trash-2" size="xs" />
          </button>
        </div>
      </div>
    </div>
  );
}

