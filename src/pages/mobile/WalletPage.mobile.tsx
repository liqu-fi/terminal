import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MobileHeader } from '../../components/Layout';
import styles from './WalletPage.mobile.module.css';

export function MobileWalletPage() {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <MobileHeader title={t.wallet?.title || 'Wallet'} showActions={false} />
      <div className={styles.scrollContent}>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Icon name="wallet" size="lg" />
          <p style={{ marginTop: '1rem' }}>
            Wallet functionality will be available after exchange integration.
          </p>
        </div>
      </div>
    </div>
  );
}
