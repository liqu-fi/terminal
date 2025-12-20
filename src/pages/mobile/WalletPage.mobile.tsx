import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MobileHeader } from '../../components/Layout';
import { PullToRefresh } from '../../components/mobile';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import {
  DepositDrawer,
  WithdrawDrawer,
  OnboardingGuide,
  LinkedMethodsPanel,
} from '../../components/Wallet';
import styles from './WalletPage.mobile.module.css';

export function MobileWalletPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { trigger } = useHapticFeedback();
  const methodsRef = useRef<HTMLDivElement>(null);
  const stage = useWalletStore((state) => state.getOnboardingStage());
  const balances = useWalletStore(selectBalances);
  const performance = useWalletStore((state) => state.performanceMetrics);
  const setSelectedSymbol = useWatchlistStore((state) => state.setSelectedSymbol);

  const [hideBalance, setHideBalance] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);

  const handleScrollToMethods = () => {
    trigger('selection');
    methodsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleHide = () => {
    trigger('selection');
    setHideBalance(!hideBalance);
  };

  const handleDeposit = () => {
    trigger('medium');
    setDepositOpen(true);
  };

  const handleWithdraw = () => {
    trigger('medium');
    setWithdrawOpen(true);
  };

  const handleToggleAssets = () => {
    trigger('selection');
    setShowAllAssets(!showAllAssets);
  };

  // 点击资产跳转到交易页面
  const handleAssetClick = (asset: string) => {
    trigger('medium');
    // 稳定币不能作为交易对的基础资产，跳过
    if (asset === 'USDT' || asset === 'USDC' || asset === 'BUSD') {
      return;
    }
    // 设置交易对并跳转
    const symbol = `${asset}USDT`;
    setSelectedSymbol(symbol);
    navigate('/trade');
  };


  // Calculate total balance in USDT
  const totalBalance = useMemo(() => {
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    // For simplicity, just showing USDT balance as total
    // In real app, would convert all assets to USDT
    return parseFloat(usdtBalance?.total || '0');
  }, [balances]);

  // Get non-zero balances
  const activeBalances = useMemo(() => {
    return balances.filter(b => parseFloat(b.total) > 0);
  }, [balances]);

  // Format balance for display
  const formatBalance = (value: number, decimals = 2) => {
    if (hideBalance) return '****';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  if (stage === 'not_created') {
    return (
      <div className={styles.container}>
        <MobileHeader title={t.wallet?.title || 'Wallet'} />
        <div className={styles.onboardingWrapper}>
          <OnboardingGuide stage={stage} />
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { trigger('success'); }} className={styles.container}>
      {/* Header */}
      <MobileHeader
        title={t.wallet?.title || 'Wallet'}
        rightAction={
          <span className={styles.simulatedBadge}>
            {t.wallet?.simulatedBadge || 'Simulated'}
          </span>
        }
      />

      {/* Onboarding Banner */}
      {(stage === 'no_payment_method' || stage === 'no_funds') && (
        <div className={styles.onboardingBanner}>
          <OnboardingGuide 
            stage={stage} 
            onOpenDeposit={handleDeposit}
            onScrollToMethods={handleScrollToMethods}
          />
        </div>
      )}

      <div className={styles.scrollContent}>
        {/* Immersive Balance Card */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceCardBg} />
          
          <div className={styles.balanceHeader}>
            <span className={styles.balanceLabel}>
              {t.wallet?.totalBalance || 'Total Balance'}
            </span>
            <button
              className={styles.hideBtn}
              onClick={handleToggleHide}
            >
              <Icon name={hideBalance ? 'eye-off' : 'eye'} size="sm" />
            </button>
          </div>

          <div className={styles.totalBalance}>
            <span className={styles.currency}>$</span>
            <span className={`${styles.amount} tabular-nums`}>
              {formatBalance(totalBalance)}
            </span>
            <span className={styles.equivalent}>USDT</span>
          </div>

          {/* Performance Metrics */}
          <div className={styles.performanceRow}>
            <div className={styles.perfItem}>
              <span className={styles.perfLabel}>Today's PnL</span>
              <span className={`${styles.perfValue} ${parseFloat(performance?.totalRealizedPnl || '0') >= 0 ? styles.positive : styles.negative}`}>
                {parseFloat(performance?.totalRealizedPnl || '0') >= 0 ? '+' : ''}
                {hideBalance ? '****' : `$${parseFloat(performance?.totalRealizedPnl || '0').toFixed(2)}`}
              </span>
            </div>
            <div className={styles.perfDivider} />
            <div className={styles.perfItem}>
              <span className={styles.perfLabel}>Win Rate</span>
              <span className={styles.perfValue}>
                {hideBalance ? '****' : `${((performance?.winRate ?? 0) * 100).toFixed(1)}%`}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <button
              className={styles.actionBtn}
              onClick={handleDeposit}
            >
              <div className={styles.actionIcon}>
                <Icon name="download" size="md" />
              </div>
              <span>{t.wallet?.deposit || 'Deposit'}</span>
            </button>
            <button
              className={styles.actionBtn}
              onClick={handleWithdraw}
            >
              <div className={styles.actionIcon}>
                <Icon name="upload" size="md" />
              </div>
              <span>{t.wallet?.withdraw || 'Withdraw'}</span>
            </button>
            <button className={styles.actionBtn} disabled>
              <div className={styles.actionIcon}>
                <Icon name="repeat" size="md" />
              </div>
              <span>{t.wallet?.transfer || 'Transfer'}</span>
            </button>
            <button className={styles.actionBtn} disabled>
              <div className={styles.actionIcon}>
                <Icon name="history" size="md" />
              </div>
              <span>{t.wallet?.history || 'History'}</span>
            </button>
          </div>
        </div>

        {/* Asset List */}
        <div className={styles.assetSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              {t.wallet?.assets || 'Assets'}
            </span>
            <button
              className={styles.toggleBtn}
              onClick={handleToggleAssets}
            >
              {showAllAssets 
                ? (t.wallet?.hideZero || 'Hide Zero')
                : (t.wallet?.showAll || 'Show All')
              }
            </button>
          </div>

          <div className={styles.assetList}>
            {(showAllAssets ? balances : activeBalances).map((balance) => {
              const isStablecoin = ['USDT', 'USDC', 'BUSD'].includes(balance.asset);
              return (
                <div 
                  key={balance.asset} 
                  className={`${styles.assetItem} ${!isStablecoin ? styles.clickable : ''}`}
                  onClick={() => handleAssetClick(balance.asset)}
                >
                  <div className={styles.assetIcon}>
                    {balance.asset.slice(0, 2)}
                  </div>
                  <div className={styles.assetInfo}>
                    <span className={styles.assetName}>{balance.asset}</span>
                    <span className={styles.assetFullName}>
                      {balance.asset === 'USDT' ? 'Tether' :
                       balance.asset === 'BTC' ? 'Bitcoin' :
                       balance.asset === 'ETH' ? 'Ethereum' :
                       balance.asset}
                    </span>
                  </div>
                  <div className={styles.assetBalance}>
                    <span className={`${styles.balanceAmount} tabular-nums`}>
                      {hideBalance ? '****' : parseFloat(balance.total).toFixed(
                        balance.asset === 'USDT' ? 2 : 6
                      )}
                    </span>
                    <span className={styles.balanceValue}>
                      {hideBalance ? '****' : `≈ $${parseFloat(balance.total).toFixed(2)}`}
                    </span>
                  </div>
                  {!isStablecoin && (
                    <div className={styles.assetArrow}>
                      <Icon name="chevron-right" size="sm" />
                    </div>
                  )}
                </div>
              );
            })}

            {activeBalances.length === 0 && !showAllAssets && (
              <div className={styles.emptyAssets}>
                <Icon name="wallet" size="xl" />
                <span>{t.wallet?.noAssets || 'No assets yet'}</span>
                <button
                  className={styles.depositPromptBtn}
                  onClick={handleDeposit}
                >
                  {t.wallet?.depositFirst || 'Make your first deposit'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Linked Methods Section */}
        <div className={styles.methodsSection} ref={methodsRef}>
          <LinkedMethodsPanel highlightAdd={stage === 'no_payment_method'} />
        </div>
      </div>

      {/* Deposit Drawer */}
      <DepositDrawer
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
      />

      {/* Withdraw Drawer */}
      <WithdrawDrawer
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </PullToRefresh>
  );
}

