import styles from './LinkedMethodsPanel.module.css';

interface LinkedMethodsPanelProps {
  highlightAdd?: boolean;
}

export function LinkedMethodsPanel(_props: LinkedMethodsPanelProps) {
  return (
    <div className={styles.container}>
      <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
        Payment methods unavailable
      </p>
    </div>
  );
}
