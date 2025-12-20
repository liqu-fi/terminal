import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MobileWalletPage } from './mobile';
import {
  AccountOverviewCard,
  AssetBalancesPanel,
  LinkedMethodsPanel,
  LedgerTable,
  DepositDrawer,
  WithdrawDrawer,
  OnboardingGuide,
} from '../components/Wallet';
import styles from './WalletPage.module.css';

type WalletTab = 'overview' | 'spot' | 'funding' | 'history';

export function WalletPage() {
  // All hooks must be called before any conditional returns
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const stage = useWalletStore((state) => state.getOnboardingStage());
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Render mobile layout
  if (isMobile) {
    return <MobileWalletPage />;
  }

  const tabs: { id: WalletTab; label: string; icon: any }[] = [
    { id: 'overview', label: t.wallet?.overview || 'Overview', icon: 'layout' },
    { id: 'spot', label: t.wallet?.spot || 'Spot', icon: 'wallet' },
    { id: 'funding', label: t.wallet?.funding || 'Funding', icon: 'banknote' },
    { id: 'history', label: t.wallet?.history || 'History', icon: 'history' },
  ];

  return (
    <div className={styles.container}>
      {/* Header with Simulated Badge */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Icon name="wallet" size="lg" />
            {t.wallet?.title || 'Wallet'}
          </h1>
          <span 
            className={styles.simulatedBadge}
            title={t.wallet?.simulatedTooltip || 'This is a simulated wallet for paper trading.'}
          >
            {t.wallet?.simulatedBadge || 'Simulated'}
          </span>
        </div>
        
        <div className={styles.headerActions}>
          {stage !== 'not_created' && (
            <>
              <button 
                className={styles.depositButton}
                onClick={() => setDepositOpen(true)}
              >
                <Icon name="download" size="sm" />
                {t.wallet?.deposit || 'Deposit'}
              </button>
              <button 
                className={styles.withdrawButton}
                onClick={() => setWithdrawOpen(true)}
              >
                <Icon name="upload" size="sm" />
                {t.wallet?.withdraw || 'Withdraw'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      {stage !== 'not_created' && (
        <div className={styles.tabsContainer}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} size="sm" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className={styles.mainContentArea}>
        {stage === 'not_created' ? (
          <div className={styles.onboardingWrapper}>
            <OnboardingGuide stage={stage} />
          </div>
        ) : (
          <>
            {/* Onboarding Banner (for stages after account creation) */}
            {(stage === 'no_payment_method' || stage === 'no_funds') && (
              <OnboardingGuide 
                stage={stage} 
                onOpenDeposit={() => setDepositOpen(true)}
              />
            )}

            <div className={styles.content}>
              {activeTab === 'overview' && (
                <>
                  {/* Left Column */}
                  <div className={styles.leftColumn}>
                    <AccountOverviewCard />
                    <LinkedMethodsPanel highlightAdd={stage === 'no_payment_method'} />
                  </div>

                  {/* Right Column */}
                  <div className={styles.rightColumn}>
                    <AssetBalancesPanel 
                      onDeposit={() => setDepositOpen(true)}
                      onWithdraw={() => setWithdrawOpen(true)}
                    />
                  </div>
                </>
              )}

              {activeTab === 'spot' && (
                <div className={styles.fullWidthColumn}>
                  <AssetBalancesPanel 
                    onDeposit={() => setDepositOpen(true)}
                    onWithdraw={() => setWithdrawOpen(true)}
                  />
                </div>
              )}

              {activeTab === 'funding' && (
                <div className={styles.fullWidthColumn}>
                  <LinkedMethodsPanel highlightAdd={stage === 'no_payment_method'} />
                </div>
              )}

              {activeTab === 'history' && (
                <div className={styles.fullWidthColumn}>
                  <LedgerTable />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Drawers */}
      <DepositDrawer 
        isOpen={depositOpen} 
        onClose={() => setDepositOpen(false)} 
      />
      <WithdrawDrawer 
        isOpen={withdrawOpen} 
        onClose={() => setWithdrawOpen(false)} 
      />
    </div>
  );
}
