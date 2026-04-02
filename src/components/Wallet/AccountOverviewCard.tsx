import styles from './AccountOverviewCard.module.css';

export function AccountOverviewCard() {
  return (
    <div className={styles.container}>
      <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
        Account overview unavailable
      </p>
    </div>
  );
}
