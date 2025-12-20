import { useMemo } from 'react';
import { useWalletStore, selectAccount, selectBalances } from '../../store/walletStore';
import { useWatchlistStore, selectSymbols } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import Decimal from 'decimal.js';
import styles from './AccountOverviewCard.module.css';

// 资产颜色映射
const ASSET_COLORS: Record<string, string> = {
  USDT: 'var(--color-price-up)',
  BTC: '#F7931A',
  ETH: '#627EEA',
  BNB: '#F3BA2F',
  SOL: '#9945FF',
  XRP: '#23292F',
  ADA: '#0033AD',
  DOGE: '#C2A633',
  DEFAULT: 'var(--text-tertiary)',
};

export function AccountOverviewCard() {
  const { t } = useI18n();
  const account = useWalletStore(selectAccount);
  const balances = useWalletStore(selectBalances);
  const getTotalEquity = useWalletStore((state) => state.getTotalEquity);
  const symbols = useWatchlistStore(selectSymbols);
  
  // Build prices map from watchlist symbols
  const prices = useMemo(() => {
    const map: Record<string, string> = {};
    for (const sym of symbols) {
      if (sym.price) {
        map[sym.symbol] = sym.price;
      }
    }
    return map;
  }, [symbols]);
  
  const totalEquity = useMemo(() => {
    return getTotalEquity(prices);
  }, [getTotalEquity, prices]);

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

  // 计算资产分配比例
  const allocation = useMemo(() => {
    const totalEquityNum = parseFloat(totalEquity.replace(/,/g, ''));
    if (totalEquityNum <= 0) return [];

    const items: { label: string; value: number; usdValue: number; color: string }[] = [];

    for (const balance of balances) {
      const qty = new Decimal(balance.total);
      if (qty.lte(0)) continue;

      let usdValue: number;
      if (balance.asset === 'USDT') {
        usdValue = qty.toNumber();
      } else {
        const symbol = `${balance.asset}USDT`;
        const price = prices[symbol];
        if (!price) continue;
        usdValue = qty.mul(new Decimal(price)).toNumber();
      }

      if (usdValue > 0) {
        items.push({
          label: balance.asset,
          value: (usdValue / totalEquityNum) * 100,
          usdValue,
          color: (ASSET_COLORS[balance.asset] || ASSET_COLORS.DEFAULT) as string,
        });
      }
    }

    // Sort by value descending and take top 5
    return items.sort((a, b) => b.usdValue - a.usdValue).slice(0, 5);
  }, [balances, prices, totalEquity]);

  if (!account) {
    return null;
  }

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
          {allocation.length > 0 ? (
            allocation.map(item => (
              <div key={item.label} className={styles.allocationItem}>
                <div className={styles.allocationLabel}>
                  <span className={styles.colorDot} style={{ background: item.color }} />
                  {item.label}
                </div>
                <div className={styles.allocationValue}>{item.value.toFixed(1)}%</div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              {t.wallet?.noAssets || 'No assets'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

