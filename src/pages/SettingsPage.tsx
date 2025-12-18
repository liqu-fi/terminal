import { useI18n } from '../i18n';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={`card ${styles.content}`}>
        <div className="card-header">
          {t.settings?.title || 'Settings'}
        </div>
        <div className="card-body">
          <p>{t.settings?.comingSoon || 'Settings page coming soon...'}</p>
        </div>
      </div>
    </div>
  );
}





