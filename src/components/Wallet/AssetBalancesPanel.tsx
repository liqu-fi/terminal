import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AssetBalancesPanel.module.css';

interface AssetBalancesPanelProps {
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export function AssetBalancesPanel({ onDeposit, onWithdraw }: AssetBalancesPanelProps) {
  const { t } = useI18n();
  const balances = useWalletStore(selectBalances);
  
  const [search, setSearch] = useState('');
  const [hideSmall, setHideSmall] = useState(false);

  // Filter and search
  const displayBalances = useMemo(() => {
    return balances.filter((b) => {
      const matchesSearch = b.asset.toLowerCase().includes(search.toLowerCase());
      const isNotSmall = !hideSmall || new Decimal(b.total).gt(0.00000001);
      const isEssential = b.asset === 'USDT' || new Decimal(b.total).gt(0);
      return matchesSearch && (hideSmall ? isNotSmall : isEssential);
    });
  }, [balances, search, hideSmall]);

  const hasAnyBalance = useMemo(() => {
    return balances.some((b) => new Decimal(b.total).gt(0));
  }, [balances]);

  const formatAmount = (amount: string, asset: string) => {
    const dec = new Decimal(amount);
    if (asset === 'USDT') {
      return dec.toFixed(2);
    }
    // For crypto, show more precision
    if (dec.eq(0)) return '0';
    if (dec.lt(0.0001)) return dec.toExponential(4);
    return dec.toFixed(8).replace(/\.?0+$/, '');
  };

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">
        <div className={styles.headerLeft}>
          <Icon name="wallet" size="sm" />
          <span>{t.wallet?.assetBalances || 'Asset Balances'}</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Icon name="search" size="sm" />
            <input 
              type="text" 
              placeholder={t.wallet?.searchAssets || 'Search...'} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button 
            className={styles.actionButton}
            onClick={onDeposit}
            title={t.wallet?.deposit || 'Deposit'}
          >
            <Icon name="download" size="sm" />
            <span>{t.wallet?.deposit || 'Deposit'}</span>
          </button>
          <button 
            className={styles.actionButton}
            onClick={onWithdraw}
            disabled={!hasAnyBalance}
            title={t.wallet?.withdraw || 'Withdraw'}
          >
            <Icon name="upload" size="sm" />
            <span>{t.wallet?.withdraw || 'Withdraw'}</span>
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={hideSmall} 
            onChange={(e) => setHideSmall(e.target.checked)} 
          />
          <span>{t.wallet?.hideSmallBalances || 'Hide small balances'}</span>
        </label>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.wallet?.asset || 'Asset'}</th>
              <th className={styles.numericHeader}>{t.wallet?.available || 'Available'}</th>
              <th className={styles.numericHeader}>{t.wallet?.frozen || 'Frozen'}</th>
              <th className={styles.numericHeader}>{t.wallet?.total || 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {displayBalances.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.emptyRow}>
                  <div className={styles.emptyState}>
                    <Icon name="wallet" size="lg" />
                    <span>{t.wallet?.noAssets || 'No assets yet'}</span>
                    <button 
                      className={styles.depositButton}
                      onClick={onDeposit}
                    >
                      {t.wallet?.depositNow || 'Deposit Now'}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              displayBalances.map((balance) => {
                const hasFrozen = new Decimal(balance.frozen).gt(0);
                return (
                  <tr key={balance.asset}>
                    <td>
                      <div className={styles.assetCell}>
                        <div className={styles.assetIcon}>{balance.asset[0]}</div>
                        <span className={styles.assetName}>{balance.asset}</span>
                      </div>
                    </td>
                    <td className={styles.numericCell}>
                      {formatAmount(balance.available, balance.asset)}
                    </td>
                    <td className={`${styles.numericCell} ${hasFrozen ? styles.frozenValue : ''}`}>
                      {hasFrozen ? formatAmount(balance.frozen, balance.asset) : '-'}
                    </td>
                    <td className={styles.numericCell}>
                      {formatAmount(balance.total, balance.asset)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


