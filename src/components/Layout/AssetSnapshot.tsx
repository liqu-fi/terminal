import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import styles from './AssetSnapshot.module.css';

export const AssetSnapshot: FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className={styles.container} onClick={() => navigate('/orders')} style={{ cursor: 'pointer' }}>
      <div className={styles.item}>
        <span className={styles.label}>{t.account.totalValue}</span>
        <div className={styles.valueWrapper}>
          <span className={`${styles.value} tabular-nums`}>--</span>
          <span className={styles.unit}>USD</span>
        </div>
      </div>
    </div>
  );
};
