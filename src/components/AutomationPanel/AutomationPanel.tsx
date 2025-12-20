import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { Icon } from '../Icon';
import { TriggerForm } from './TriggerForm';
import { TriggerList } from './TriggerList';
import { ExecutionLogList } from './ExecutionLogList';
import styles from './AutomationPanel.module.css';

type TabType = 'active' | 'create' | 'logs';

interface AutomationPanelProps {
  isEmbedded?: boolean;
}

export function AutomationPanel({ isEmbedded = false }: AutomationPanelProps) {
  const { t } = useI18n();
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const [isExpanded, setIsExpanded] = useState(isEmbedded);
  const [activeTab, setActiveTab] = useState<TabType>('active');

  const toggleExpand = () => {
    if (isEmbedded) return;
    setIsExpanded(!isExpanded);
  };

  if (!t.automation) {
    console.error('[AutomationPanel] i18n section "automation" is missing');
    return null;
  }

  return (
    <div className={`${!isEmbedded ? 'card' : ''} ${styles.container} ${isEmbedded ? styles.embedded : ''}`}>
      {!isEmbedded && (
        <div className={styles.header} onClick={toggleExpand}>
          <div className={styles.title}>
            <Icon name="zap" size="sm" />
            <span>{t.automation.panelTitle}</span>
          </div>
          <Icon 
            name="chevron-down" 
            size="sm" 
            className={`${styles.headerIcon} ${isExpanded ? styles.expanded : ''}`} 
          />
        </div>
      )}

      {isExpanded && (
        <div className={styles.content}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'active' ? styles.active : ''}`}
              onClick={() => setActiveTab('active')}
            >
              {t.automation.activeTriggers}
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'create' ? styles.active : ''}`}
              onClick={() => setActiveTab('create')}
            >
              {t.automation.createTrigger}
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              {t.automation.logs}
            </button>
          </div>

          <div className={styles.scrollArea}>
            {activeTab === 'active' && (
              <TriggerList filterSymbol={selectedSymbol} />
            )}
            {activeTab === 'create' && (
              <TriggerForm onSuccess={() => setActiveTab('active')} />
            )}
            {activeTab === 'logs' && (
              <ExecutionLogList />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

