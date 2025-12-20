import { useState } from 'react';
import { useWalletStore } from '../../store/walletStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n, formatMessage } from '../../i18n';
import { Icon } from '../Icon';
import type { OnboardingStage } from '../../types/wallet';
import styles from './OnboardingGuide.module.css';

interface OnboardingGuideProps {
  stage: OnboardingStage;
  onOpenDeposit?: () => void;
  onScrollToMethods?: () => void;
}

export function OnboardingGuide({ stage, onOpenDeposit, onScrollToMethods }: OnboardingGuideProps) {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const createAccount = useWalletStore((state) => state.createAccount);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCreateAccount = async () => {
    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    createAccount();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    setIsCreating(false);
  };

  if (stage === 'not_created') {
    return (
      <div className={styles.fullScreenGuide}>
        <div className={styles.guideCard}>
          <div className={styles.iconWrapper}>
            <Icon name="wallet" size="xl" />
          </div>
          <h2 className={styles.title}>
            {t.wallet?.createAccountTitle || 'Initialize Wallet'}
          </h2>
          <p className={styles.description}>
            {formatMessage(t.wallet?.createAccountDesc || 'Detection session for {username}. Would you like to initialize a simulated wallet?', { username: user?.username || 'user' })}
          </p>
          
          {showSuccess ? (
            <div className={styles.successMessage}>
              <Icon name="check-circle" size="sm" />
              <span>{t.wallet?.accountCreated || 'Wallet initialized!'}</span>
            </div>
          ) : (
            <div className={styles.actionGroup}>
              <button
                className={styles.primaryButton}
                onClick={handleCreateAccount}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Icon name="loader" size="sm" className={styles.spinning} />
                    <span>{t.wallet?.creatingAccount || 'Initializing...'}</span>
                  </>
                ) : (
                  <>
                    <Icon name="plus" size="sm" />
                    <span>{t.wallet?.createAccount || 'Initialize Now'}</span>
                  </>
                )}
              </button>
              <button className={styles.secondaryButton} disabled>
                <Icon name="link" size="sm" />
                <span>Link External Wallet</span>
              </button>
            </div>
          )}

          <div className={styles.steps}>
            <div className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepNumber}>1</span>
              <span>{t.wallet?.createAccount || 'Initialize'}</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <span>{t.wallet?.addBankCard || 'Link Channels'}</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <span>{t.wallet?.deposit || 'Deposit'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'no_payment_method') {
    return (
      <div className={styles.topBanner}>
        <div className={styles.bannerIcon}>
          <Icon name="link" size="sm" />
        </div>
        <div className={styles.bannerContent}>
          <span className={styles.bannerTitle}>
            {t.wallet?.addPaymentFirst || 'Add a payment method to deposit funds'}
          </span>
          <span className={styles.bannerHint}>
            {t.wallet?.addPaymentDesc || 'Link a bank card or crypto address to simulate deposits and withdrawals.'}
          </span>
        </div>
        {onScrollToMethods && (
          <button className={styles.bannerButton} onClick={onScrollToMethods}>
            <Icon name="plus" size="sm" />
            <span>{t.common?.confirm || 'Add'}</span>
          </button>
        )}
        <div className={styles.stepIndicator}>
          {t.wallet?.step || 'Step'} 2 {t.wallet?.of || 'of'} 3
        </div>
      </div>
    );
  }

  if (stage === 'no_funds') {
    return (
      <div className={styles.topBanner}>
        <div className={styles.bannerIcon}>
          <Icon name="download" size="sm" />
        </div>
        <div className={styles.bannerContent}>
          <span className={styles.bannerTitle}>
            {t.wallet?.noFundsYet || 'No funds yet'}
          </span>
          <span className={styles.bannerHint}>
            {t.wallet?.noFundsDesc || 'Deposit funds to start trading. This is simulated money for paper trading.'}
          </span>
        </div>
        <button className={styles.bannerButton} onClick={onOpenDeposit}>
          {t.wallet?.depositNow || 'Deposit Now'}
        </button>
      </div>
    );
  }

  return null;
}
