import styles from './AssetBalancesPanel.module.css';

interface AssetBalancesPanelProps {
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export function AssetBalancesPanel(_props: AssetBalancesPanelProps) {
  return (
    <div className={styles.container}>
      <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
        Asset balances unavailable
      </p>
    </div>
  );
}
