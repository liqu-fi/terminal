import { useI18n } from '../../i18n';
import styles from './AccountRibbon.module.css';

export function AccountRibbon() {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.item}>
        <span className={styles.label}>{t.account?.totalValue || 'Total'}</span>
        <span className={`${styles.value} tabular-nums`}>--</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.item}>
        <span className={styles.label}>{t.account?.available || 'Available'}</span>
        <span className={`${styles.value} tabular-nums`}>--</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.item}>
        <span className={styles.label}>Position</span>
        <span className={`${styles.value} tabular-nums`}>--</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.item}>
        <span className={styles.label}>{t.positions?.unrealizedPnL || 'Unrealized P&L'}</span>
        <span className={`${styles.value} ${styles.pnl} tabular-nums`}>--</span>
      </div>
    </div>
  );
}
