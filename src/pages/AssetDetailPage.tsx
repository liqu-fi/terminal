import { useI18n } from '../i18n';
import styles from './AssetDetailPage.module.css';

export function AssetDetailPage() {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <p style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
        {t.wallet?.title || 'Asset details will be available after exchange integration.'}
      </p>
    </div>
  );
}
