import { useMemo, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AssetSnapshot.module.css';

export const AssetSnapshot: FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const balances = useWalletStore((state) => state.balances);
  const getTotalEquity = useWalletStore((state) => state.getTotalEquity);
  
  const equity = useMemo(() => {
    return getTotalEquity({});
  }, [balances, getTotalEquity]);

  const hasFunds = parseFloat(equity) > 0;

  return (
    <div className={styles.container} onClick={() => navigate('/assets')} style={{ cursor: 'pointer' }}>
      <div className={styles.item}>
        <span className={styles.label}>{t.account.totalValue}</span>
        <div className={styles.valueWrapper}>
          <span className={`${styles.value} tabular-nums`}>{equity}</span>
          <span className={styles.unit}>USDT</span>
        </div>
      </div>
      
      {!hasFunds && (
        <div className={styles.warning} title={t.wallet?.noFundsDesc}>
          <Icon name="alert-triangle" size="xs" />
        </div>
      )}
    </div>
  );
};

