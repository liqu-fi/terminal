import { useState, useMemo } from 'react';
import { useWalletStore, selectPaymentMethods, selectCryptoAddresses, selectDeposits } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import { StatusCard } from './StatusCard';
import styles from './DepositDrawer.module.css';

interface DepositDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositDrawer({ isOpen, onClose }: DepositDrawerProps) {
  const { t } = useI18n();
  const paymentMethods = useWalletStore(selectPaymentMethods);
  const cryptoAddresses = useWalletStore(selectCryptoAddresses);
  const deposits = useWalletStore(selectDeposits);
  const createDeposit = useWalletStore((state) => state.createDeposit);
  const confirmDeposit = useWalletStore((state) => state.confirmDeposit);

  const [asset, setAsset] = useState<'USDT' | 'CNY'>('USDT');
  const [amount, setAmount] = useState('');
  const [sourceType, setSourceType] = useState<'bank' | 'crypto'>('crypto');
  const [sourceId, setSourceId] = useState('');
  const [pendingDepositId, setPendingDepositId] = useState<string | null>(null);

  // Get current pending deposit
  const pendingDeposit = useMemo(() => {
    if (!pendingDepositId) return null;
    return deposits.find((d) => d.depositId === pendingDepositId);
  }, [deposits, pendingDepositId]);

  // Get available sources
  const sources = useMemo(() => {
    if (sourceType === 'bank') {
      return paymentMethods.map((m) => ({
        id: m.id,
        label: `${m.bankName} ****${m.lastFour}`,
      }));
    }
    return cryptoAddresses.map((a) => ({
      id: a.id,
      label: `${a.chain}: ${a.address.slice(0, 8)}...${a.address.slice(-6)}`,
    }));
  }, [sourceType, paymentMethods, cryptoAddresses]);

  // Reset source when type changes
  const handleSourceTypeChange = (type: 'bank' | 'crypto') => {
    setSourceType(type);
    setSourceId('');
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 10000000) return;
    if (!sourceId) return;

    const deposit = createDeposit(asset, amount, sourceType, sourceId);
    setPendingDepositId(deposit.depositId);
  };

  const handleConfirmDemo = () => {
    if (pendingDepositId) {
      confirmDeposit(pendingDepositId);
    }
  };

  const handleClose = () => {
    // Reset form
    setAsset('USDT');
    setAmount('');
    setSourceType('crypto');
    setSourceId('');
    setPendingDepositId(null);
    onClose();
  };

  const isValid = useMemo(() => {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount > 0 && numAmount <= 10000000 && sourceId;
  }, [amount, sourceId]);

  const hasSources = paymentMethods.length > 0 || cryptoAddresses.length > 0;

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={handleClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Icon name="download" size="md" />
            {t.wallet?.depositTitle || 'Deposit Funds'}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <Icon name="x" size="md" />
          </button>
        </div>

        <div className={styles.content}>
          {/* Show status card if deposit is pending */}
          {pendingDeposit && pendingDeposit.status === 'pending' ? (
            <StatusCard
              status="pending"
              title={t.wallet?.depositPending || 'Processing Deposit...'}
              subtitle={`${pendingDeposit.amount} ${pendingDeposit.asset}`}
              estimatedSeconds={8}
              onConfirmDemo={handleConfirmDemo}
              confirmDemoLabel={t.wallet?.confirmForDemo || 'Confirm for Demo'}
              confirmDemoHint={t.wallet?.confirmForDemoHint || 'Skip waiting for demo purposes'}
            />
          ) : pendingDeposit && pendingDeposit.status === 'confirmed' ? (
            <StatusCard
              status="success"
              title={t.wallet?.depositConfirmed || 'Deposit Confirmed'}
              subtitle={`+${pendingDeposit.amount} ${pendingDeposit.asset}`}
            />
          ) : (
            <>
              {/* No sources warning */}
              {!hasSources && (
                <div className={styles.warningCard}>
                  <div className={styles.warningInfo}>
                    <Icon name="alert-triangle" size="sm" />
                    <span>{t.wallet?.addPaymentFirst || 'Add a payment method to deposit funds'}</span>
                  </div>
                  <button 
                    className={styles.addSourceBtn}
                    onClick={() => {
                      onClose();
                      // On mobile, this will scroll to methods if we're on the wallet page
                      // On desktop, it will also be visible
                      const methodsEl = document.querySelector('[class*="methodsSection"]');
                      if (methodsEl) {
                        methodsEl.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {t.common?.confirm || 'Add Now'}
                  </button>
                </div>
              )}

              {/* Asset selection */}
              <div className={styles.field}>
                <label className={styles.label}>
                  {t.wallet?.selectAsset || 'Select Asset'}
                </label>
                <div className={styles.assetButtons}>
                  <button
                    className={`${styles.assetButton} ${asset === 'USDT' ? styles.active : ''}`}
                    onClick={() => setAsset('USDT')}
                  >
                    USDT
                  </button>
                  <button
                    className={`${styles.assetButton} ${asset === 'CNY' ? styles.active : ''}`}
                    onClick={() => setAsset('CNY')}
                  >
                    CNY
                  </button>
                </div>
              </div>

              {/* Amount input */}
              <div className={styles.field}>
                <label className={styles.label}>
                  {t.wallet?.enterAmount || 'Enter Amount'}
                </label>
                <div className={styles.amountInput}>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={styles.input}
                    min="1"
                    max="10000000"
                  />
                  <span className={styles.amountSuffix}>{asset}</span>
                </div>
                <div className={styles.hint}>
                  {t.wallet?.maxAmount || 'Max amount per deposit: 10,000,000'}
                </div>
              </div>

              {/* Source type selection */}
              <div className={styles.field}>
                <label className={styles.label}>
                  {t.wallet?.selectSource || 'Select Source'}
                </label>
                <div className={styles.sourceTypeButtons}>
                  <button
                    className={`${styles.sourceTypeButton} ${sourceType === 'crypto' ? styles.active : ''}`}
                    onClick={() => handleSourceTypeChange('crypto')}
                  >
                    <Icon name="wallet" size="sm" />
                    <span>{t.wallet?.cryptoAddresses || 'Crypto'}</span>
                  </button>
                  <button
                    className={`${styles.sourceTypeButton} ${sourceType === 'bank' ? styles.active : ''}`}
                    onClick={() => handleSourceTypeChange('bank')}
                  >
                    <Icon name="building-2" size="sm" />
                    <span>{t.wallet?.bankCards || 'Bank'}</span>
                  </button>
                </div>
              </div>

              {/* Source selection */}
              {sources.length > 0 ? (
                <div className={styles.field}>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">-- {t.wallet?.selectSource || 'Select Source'} --</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.noSourcesHint}>
                  {sourceType === 'bank' 
                    ? t.wallet?.noBankCards || 'No bank cards linked'
                    : t.wallet?.noAddresses || 'No addresses linked'
                  }
                </div>
              )}

              {/* Submit button */}
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={!isValid || !hasSources}
              >
                {t.wallet?.deposit || 'Deposit'}
              </button>
            </>
          )}

          {/* Close button after completion */}
          {pendingDeposit && pendingDeposit.status === 'confirmed' && (
            <button className={styles.doneButton} onClick={handleClose}>
              {t.common?.close || 'Close'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

