import { useState, useMemo } from 'react';
import { useWalletStore } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import type { LedgerFilter, LedgerType } from '../../types/wallet';
import styles from './LedgerTable.module.css';

const PAGE_SIZE = 20;

export function LedgerTable() {
  const { t } = useI18n();
  const getFilteredLedger = useWalletStore((state) => state.getFilteredLedger);
  
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const filteredLedger = useMemo(() => {
    return getFilteredLedger(filter);
  }, [getFilteredLedger, filter]);

  const displayedLedger = useMemo(() => {
    return filteredLedger.slice(0, displayCount);
  }, [filteredLedger, displayCount]);

  const hasMore = displayCount < filteredLedger.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  const getLedgerTypeLabel = (type: LedgerType): string => {
    const labels = t.wallet?.ledgerTypes as Record<LedgerType, string> | undefined;
    return labels?.[type] || type;
  };

  const getTypeColor = (type: LedgerType): string => {
    switch (type) {
      case 'DEPOSIT':
        return 'var(--color-success)';
      case 'WITHDRAW_FREEZE':
      case 'WITHDRAW_COMPLETE':
        return 'var(--color-error)';
      case 'WITHDRAW_REFUND':
        return 'var(--color-warning)';
      case 'ORDER_FREEZE':
        return 'var(--color-warning)';
      case 'ORDER_UNFREEZE':
        return 'var(--color-info)';
      case 'FILL':
        return 'var(--accent)';
      case 'FEE':
        return 'var(--text-secondary)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const filterOptions: { value: LedgerFilter; label: string }[] = [
    { value: 'all', label: t.wallet?.filterAll || 'All' },
    { value: 'deposit', label: t.wallet?.filterDeposit || 'Deposit' },
    { value: 'withdraw', label: t.wallet?.filterWithdraw || 'Withdraw' },
    { value: 'trade', label: t.wallet?.filterTrade || 'Trade' },
    { value: 'fee', label: t.wallet?.filterFee || 'Fee' },
  ];

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">
        <div className={styles.headerLeft}>
          <Icon name="history" size="sm" />
          <span>{t.wallet?.ledger || 'Fund History'}</span>
        </div>
        <div className={styles.filters}>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`${styles.filterButton} ${filter === option.value ? styles.active : ''}`}
              onClick={() => {
                setFilter(option.value);
                setDisplayCount(PAGE_SIZE);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {filteredLedger.length === 0 ? (
          <div className={styles.emptyState}>
            <Icon name="history" size="xl" />
            <span>{t.wallet?.noRecords || 'No records yet'}</span>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.wallet?.time || 'Time'}</th>
                <th>{t.wallet?.type || 'Type'}</th>
                <th>{t.wallet?.asset || 'Asset'}</th>
                <th className={styles.numericHeader}>{t.wallet?.amount || 'Amount'}</th>
                <th className={styles.numericHeader}>{t.orders?.fee || 'Fee'}</th>
                <th>{t.wallet?.reference || 'Reference'}</th>
              </tr>
            </thead>
            <tbody>
              {displayedLedger.map((entry) => (
                <tr key={entry.entryId}>
                  <td className={styles.timeCell}>
                    <div className={styles.timeWrapper}>
                      <span className={styles.timeValue}>{formatTime(entry.createdAt)}</span>
                      <span className={styles.dateValue}>{formatDate(entry.createdAt)}</span>
                    </div>
                  </td>
                  <td>
                    <span 
                      className={styles.typeBadge}
                      style={{ color: getTypeColor(entry.type) }}
                    >
                      {getLedgerTypeLabel(entry.type)}
                    </span>
                  </td>
                  <td className={styles.assetCell}>
                    {entry.asset}
                  </td>
                  <td className={styles.numericCell}>
                    <span 
                      className={`${styles.amountValue} ${
                        entry.direction === '+' ? styles.positive : styles.negative
                      }`}
                    >
                      {entry.direction}{entry.amount}
                    </span>
                  </td>
                  <td className={styles.numericCell}>
                    {parseFloat(entry.fee) > 0 ? (
                      <span className={styles.feeValue}>-{entry.fee}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.referenceCell}>
                    <span className={styles.referenceId} title={entry.referenceId}>
                      {entry.referenceId.slice(0, 12)}...
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {hasMore && (
          <div className={styles.loadMore}>
            <button className={styles.loadMoreButton} onClick={handleLoadMore}>
              {t.wallet?.loadMore || 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

