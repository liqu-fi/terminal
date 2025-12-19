import { useMemo } from 'react';
import { useWalletStore, selectAccount } from '../../store/walletStore';
import { useMarketStore, selectMetrics, selectOrderBook } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AccountOverviewCard.module.css';

export function AccountOverviewCard() {
  const { t } = useI18n();
  const account = useWalletStore(selectAccount);
  const getTotalEquity = useWalletStore((state) => state.getTotalEquity);
  
  // Get current prices from market store for equity calculation
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  
  const totalEquity = useMemo(() => {
    // Build prices map from current market data
    const prices: Record<string, string> = {};
    if (orderBook?.symbol && metrics?.mid) {
      prices[orderBook.symbol] = metrics.mid;
    }
    // For demo, we'll use USDT balance directly if no prices available
    return getTotalEquity(prices);
  }, [getTotalEquity, metrics, orderBook]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'var(--color-success)';
      case 'pending':
        return 'var(--color-warning)';
      case 'suspended':
        return 'var(--color-error)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t.wallet?.statusActive || 'Active';
      case 'pending':
        return t.wallet?.statusPending || 'Pending';
      case 'suspended':
        return t.wallet?.statusSuspended || 'Suspended';
      default:
        return status;
    }
  };

  if (!account) {
    return null;
  }

  // Sample allocation for visual (can be derived from balances)
  const allocation = [
    { label: 'USDT', value: 75, color: 'var(--color-price-up)' },
    { label: 'BTC', value: 15, color: '#F7931A' },
    { label: 'ETH', value: 10, color: '#627EEA' },
  ];

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">
        <Icon name="briefcase" size="sm" />
        <span>{t.wallet?.accountOverview || 'Account Overview'}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.topSection}>
          <div className={styles.equitySection}>
            <div className={styles.equityLabel}>
              {t.wallet?.totalEquity || 'Total Equity'}
            </div>
            <div className={styles.equityValue}>
              <span className={styles.currencySymbol}>$</span>
              {totalEquity}
            </div>
          </div>
          
          {/* Simple SVG Pie Chart */}
          <div className={styles.chartSection}>
            <svg viewBox="0 0 36 36" className={styles.pieChart}>
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="3"
              />
              {allocation.map((item, i) => {
                const total = allocation.reduce((sum, a) => sum + a.value, 0);
                const before = allocation.slice(0, i).reduce((sum, a) => sum + a.value, 0);
                const dashArray = `${(item.value / total) * 100} 100`;
                const dashOffset = `-${(before / total) * 100}`;
                return (
                  <path
                    key={item.label}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="3"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                  />
                );
              })}
            </svg>
          </div>
        </div>
        
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              {t.wallet?.accountId || 'Account ID'}
            </span>
            <span className={styles.detailValue}>
              {account.accountId}
            </span>
          </div>
          
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              {t.wallet?.accountStatus || 'Status'}
            </span>
            <span 
              className={styles.statusBadge}
              style={{ color: getStatusColor(account.status) }}
            >
              <span 
                className={styles.statusDot}
                style={{ backgroundColor: getStatusColor(account.status) }}
              />
              {getStatusText(account.status)}
            </span>
          </div>
        </div>

        <div className={styles.allocationList}>
          {allocation.map(item => (
            <div key={item.label} className={styles.allocationItem}>
              <div className={styles.allocationLabel}>
                <span className={styles.colorDot} style={{ background: item.color }} />
                {item.label}
              </div>
              <div className={styles.allocationValue}>{item.value}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

