import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import styles from './WalletPage.module.css';

export function WalletPage() {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Icon name="wallet" size="lg" />
            {t.wallet?.title || 'Wallet'}
          </h1>
        </div>
      </div>
      <div className={styles.mainContentArea}>
        <p style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
          Wallet functionality will be available after exchange integration.
        </p>
      </div>
    </div>
  );
}
