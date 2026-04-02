import styles from './LedgerTable.module.css';

export function LedgerTable() {
  return (
    <div className={styles.container}>
      <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
        Ledger unavailable
      </p>
    </div>
  );
}
