import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AccountOverviewPanel.module.css';

export const AccountOverviewPanel: React.FC = () => {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
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
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatarPlaceholder}>
            <Icon name="user" size="sm" />
          </div>
        </div>
        <div className={styles.userInfo}>
          <span className={styles.displayName}>Wallet User</span>
        </div>
      </div>

      <div className={styles.equitySection}>
        <div className={styles.equityLabel}>
          {t.accountOverview?.totalEquity || 'Total Equity'}
        </div>
        <div className={styles.equityValue}>
          <span className={styles.currency}>$</span>
          --
          <span className={styles.currencyCode}>USD</span>
        </div>
      </div>

      <div className={styles.quickActions}>
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
