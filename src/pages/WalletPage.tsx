import { useI18n } from '../i18n';
import styles from './WalletPage.module.css';

export function WalletPage() {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={`card ${styles.content}`}>
        <div className="card-header">
          {t.wallet?.title || 'Wallet'}
        </div>
        <div className="card-body">
          <p>{t.wallet?.comingSoon || 'Wallet page coming soon...'}</p>
        </div>
      </div>
    </div>
  );
}





