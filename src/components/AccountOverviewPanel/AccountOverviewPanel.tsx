import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import { useMarketStore, selectMetrics } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import Decimal from 'decimal.js';
import styles from './AccountOverviewPanel.module.css';

export const AccountOverviewPanel: React.FC = () => {
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuthStore();
  const { balances, account } = useWalletStore();
  const metrics = useMarketStore(selectMetrics);

  // Calculate total equity - simplified to use USDT balance + current position value
  const { totalEquity, availableBalance, frozenBalance } = useMemo(() => {
    if (!balances || !balances.length) {
      return { totalEquity: '0.00', availableBalance: '0.00', frozenBalance: '0.00' };
    }

    let total = new Decimal(0);
    let available = new Decimal(0);
    let frozen = new Decimal(0);

    for (const b of balances) {
      const avail = new Decimal(b.available || '0');
      const froz = new Decimal(b.frozen || '0');
      const qty = avail.plus(froz);

      if (qty.lte(0)) continue;

      // For available/frozen, only count USDT for simplicity
      if (b.asset === 'USDT') {
        available = available.plus(avail);
        frozen = frozen.plus(froz);
        total = total.plus(qty);
      } else {
        // For non-USDT assets, use mid price if available from current market data
        const midPrice = metrics?.mid ? parseFloat(metrics.mid) : 0;
        if (midPrice > 0) {
          // This is a rough approximation - only works for currently selected symbol
          total = total.plus(qty.times(midPrice));
        }
      }
    }

    return {
      totalEquity: total.toFixed(2),
      availableBalance: available.toFixed(2),
      frozenBalance: frozen.toFixed(2),
    };
  }, [balances, metrics]);

  const hasFunds = parseFloat(totalEquity) > 0;

  // Not logged in state
  if (!isAuthenticated || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.notLoggedIn}>
          <div className={styles.notLoggedInIcon}>
            <Icon name="user" size="lg" />
          </div>
          <p className={styles.notLoggedInTitle}>
            {t.accountOverview?.notLoggedIn || 'Not Signed In'}
          </p>
          <p className={styles.notLoggedInDesc}>
            {t.accountOverview?.signInPrompt || 'Sign in to view your account'}
          </p>
          <Link to="/auth" className={styles.signInBtn}>
            {t.auth?.signIn || 'Sign In'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with avatar and name */}
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          {user.avatar ? (
            <img src={user.avatar} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              <Icon name="user" size="sm" />
            </div>
          )}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.displayName}>{user.displayName || user.username}</span>
          {account && (
            <span className={styles.accountId}>{account.accountId}</span>
          )}
        </div>
      </div>

      {/* Equity Section */}
      <div className={styles.equitySection}>
        <div className={styles.equityLabel}>
          {t.accountOverview?.totalEquity || 'Total Equity'}
        </div>
        <div className={styles.equityValue}>
          <span className={styles.currency}>$</span>
          {formatNumber(totalEquity)}
          <span className={styles.currencyCode}>USD</span>
        </div>
      </div>

      {/* Balance Details */}
      <div className={styles.balanceGrid}>
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>
            {t.accountOverview?.available || 'Available'}
          </span>
          <span className={styles.balanceValue}>${formatNumber(availableBalance)}</span>
        </div>
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>
            {t.accountOverview?.frozen || 'Frozen'}
          </span>
          <span className={styles.balanceValue}>${formatNumber(frozenBalance)}</span>
        </div>
      </div>

      {/* No funds prompt */}
      {!hasFunds && (
        <div className={styles.noFundsPrompt}>
          <Icon name="wallet" size="sm" />
          <span>{t.accountOverview?.depositPrompt || 'Deposit to start trading'}</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <Link to="/wallet" className={styles.actionBtn}>
          <Icon name="wallet" size="sm" />
          <span>{t.accountOverview?.viewWallet || 'Wallet'}</span>
        </Link>
        <Link to="/orders" className={styles.actionBtn}>
          <Icon name="file-text" size="sm" />
          <span>{t.accountOverview?.viewOrders || 'Orders'}</span>
        </Link>
        <Link to="/settings" className={styles.actionBtn}>
          <Icon name="settings" size="sm" />
          <span>{t.accountOverview?.accountSettings || 'Settings'}</span>
        </Link>
      </div>
    </div>
  );
};

function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

