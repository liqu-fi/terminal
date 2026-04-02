import styles from './OnboardingGuide.module.css';

interface OnboardingGuideProps {
  stage: string;
  onOpenDeposit?: () => void;
}

export function OnboardingGuide(_props: OnboardingGuideProps) {
  return (
    <div className={styles.container}>
      <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
        Onboarding unavailable
      </p>
    </div>
  );
}
