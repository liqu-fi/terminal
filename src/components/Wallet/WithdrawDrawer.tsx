import { useState, useMemo } from 'react';
import Decimal from 'decimal.js';
import { useWalletStore, selectPaymentMethods, selectCryptoAddresses, selectBalances, selectWithdraws } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import { StatusCard } from './StatusCard';
import styles from './WithdrawDrawer.module.css';

interface WithdrawDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const WITHDRAW_FEE_RATE = 0.001; // 0.1%
const MIN_WITHDRAW_FEE = 1;

export function WithdrawDrawer({ isOpen, onClose }: WithdrawDrawerProps) {
  const { t } = useI18n();
  const paymentMethods = useWalletStore(selectPaymentMethods);
  const cryptoAddresses = useWalletStore(selectCryptoAddresses);
  const balances = useWalletStore(selectBalances);
  const withdraws = useWalletStore(selectWithdraws);
  const createWithdraw = useWalletStore((state) => state.createWithdraw);

  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [destinationType, setDestinationType] = useState<'bank' | 'crypto'>('crypto');
  const [destinationId, setDestinationId] = useState('');
  const [pendingWithdrawId, setPendingWithdrawId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get current pending withdraw
  const pendingWithdraw = useMemo(() => {
    if (!pendingWithdrawId) return null;
    return withdraws.find((w) => w.withdrawId === pendingWithdrawId);
  }, [withdraws, pendingWithdrawId]);

  // Get available assets (with balance > 0)
  const availableAssets = useMemo(() => {
    return balances.filter((b) => new Decimal(b.available).gt(0));
  }, [balances]);

  // Get current balance
  const currentBalance = useMemo(() => {
    return balances.find((b) => b.asset === asset);
  }, [balances, asset]);

  // Get available destinations
  const destinations = useMemo(() => {
    if (destinationType === 'bank') {
      return paymentMethods.map((m) => ({
        id: m.id,
        label: `${m.bankName} ****${m.lastFour}`,
      }));
    }
    return cryptoAddresses.map((a) => ({
      id: a.id,
      label: `${a.chain}: ${a.address.slice(0, 8)}...${a.address.slice(-6)}`,
    }));
  }, [destinationType, paymentMethods, cryptoAddresses]);

  // Calculate fee
  const fee = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return '0';
    const feeByRate = new Decimal(numAmount).times(WITHDRAW_FEE_RATE);
    return Decimal.max(feeByRate, MIN_WITHDRAW_FEE).toFixed(asset === 'USDT' ? 2 : 8);
  }, [amount, asset]);

  // Calculate receive amount
  const receiveAmount = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return '0';
    return new Decimal(numAmount).minus(fee).toFixed(asset === 'USDT' ? 2 : 8);
  }, [amount, fee, asset]);

  const handleDestinationTypeChange = (type: 'bank' | 'crypto') => {
    setDestinationType(type);
    setDestinationId('');
  };

  const handleSubmit = () => {
    setError(null);
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t.wallet?.minAmount || 'Minimum amount: 1');
      return;
    }
    
    if (!destinationId) {
      setError(t.wallet?.addDestinationFirst || 'Add a destination first');
      return;
    }

    const result = createWithdraw(asset, amount, destinationType, destinationId);
    
    if (!result) {
      setError(t.wallet?.insufficientBalance || 'Insufficient available balance');
      return;
    }

    setPendingWithdrawId(result.withdrawId);
  };

  const handleClose = () => {
    setAsset('USDT');
    setAmount('');
    setDestinationType('crypto');
    setDestinationId('');
    setPendingWithdrawId(null);
    setError(null);
    onClose();
  };

  const handleMaxAmount = () => {
    if (currentBalance) {
      // Set max available, accounting for fee
      const available = new Decimal(currentBalance.available);
      // Solve: amount + max(amount * 0.001, 1) <= available
      // For simplicity, subtract min fee first
      const maxWithFee = available.minus(MIN_WITHDRAW_FEE).div(1 + WITHDRAW_FEE_RATE);
      const maxAmount = Decimal.max(maxWithFee, 0);
      setAmount(maxAmount.toFixed(asset === 'USDT' ? 2 : 8));
    }
  };

  const isValid = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    if (!destinationId) return false;
    if (!currentBalance) return false;
    
    const totalRequired = new Decimal(numAmount).plus(fee);
    return new Decimal(currentBalance.available).gte(totalRequired);
  }, [amount, destinationId, currentBalance, fee]);

  const hasDestinations = paymentMethods.length > 0 || cryptoAddresses.length > 0;

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={handleClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Icon name="upload" size="md" />
            {t.wallet?.withdrawTitle || 'Withdraw Funds'}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <Icon name="x" size="md" />
          </button>
        </div>

        <div className={styles.content}>
          {/* Show status card if withdraw is processing */}
          {pendingWithdraw && pendingWithdraw.status === 'processing' ? (
            <StatusCard
              status="processing"
              title={t.wallet?.withdrawProcessing || 'Processing Withdraw...'}
              subtitle={`${pendingWithdraw.amount} ${pendingWithdraw.asset}`}
              estimatedSeconds={12}
            />
          ) : pendingWithdraw && pendingWithdraw.status === 'completed' ? (
            <StatusCard
              status="success"
              title={t.wallet?.withdrawCompleted || 'Withdraw Completed'}
              subtitle={`-${pendingWithdraw.amount} ${pendingWithdraw.asset}`}
            />
          ) : (
            <>
              {/* No destinations warning */}
              {!hasDestinations && (
                <div className={styles.warningCard}>
                  <div className={styles.warningInfo}>
                    <Icon name="alert-triangle" size="sm" />
                    <span>{t.wallet?.addDestinationFirst || 'Add a destination first'}</span>
                  </div>
                  <button 
                    className={styles.addSourceBtn}
                    onClick={() => {
                      onClose();
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
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className={styles.select}
                >
                  {availableAssets.length === 0 ? (
                    <option value="">-- {t.wallet?.noAssets || 'No assets'} --</option>
                  ) : (
                    availableAssets.map((b) => (
                      <option key={b.asset} value={b.asset}>
                        {b.asset} ({b.available})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Amount input */}
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>
                    {t.wallet?.amount || 'Amount'}
                  </label>
                  {currentBalance && (
                    <button className={styles.maxButton} onClick={handleMaxAmount}>
                      {t.wallet?.available || 'Available'}: {currentBalance.available}
                    </button>
                  )}
                </div>
                <div className={styles.amountInput}>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="0.00"
                    className={styles.input}
                    min="0"
                  />
                  <span className={styles.amountSuffix}>{asset}</span>
                </div>
                {error && (
                  <div className={styles.error}>{error}</div>
                )}
              </div>

              {/* Fee display */}
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>
                  {t.wallet?.withdrawFee || 'Withdraw Fee'}
                </span>
                <span className={styles.feeValue}>
                  {fee} {asset}
                </span>
              </div>

              {/* Receive amount */}
              <div className={styles.receiveRow}>
                <span className={styles.receiveLabel}>
                  {t.wallet?.youWillReceive || 'You will receive'}
                </span>
                <span className={styles.receiveValue}>
                  {receiveAmount} {asset}
                </span>
              </div>

              {/* Destination type selection */}
              <div className={styles.field}>
                <label className={styles.label}>
                  {t.wallet?.selectDestination || 'Select Destination'}
                </label>
                <div className={styles.destinationTypeButtons}>
                  <button
                    className={`${styles.destinationTypeButton} ${destinationType === 'crypto' ? styles.active : ''}`}
                    onClick={() => handleDestinationTypeChange('crypto')}
                  >
                    <Icon name="wallet" size="sm" />
                    <span>{t.wallet?.cryptoAddresses || 'Crypto'}</span>
                  </button>
                  <button
                    className={`${styles.destinationTypeButton} ${destinationType === 'bank' ? styles.active : ''}`}
                    onClick={() => handleDestinationTypeChange('bank')}
                  >
                    <Icon name="building-2" size="sm" />
                    <span>{t.wallet?.bankCards || 'Bank'}</span>
                  </button>
                </div>
              </div>

              {/* Destination selection */}
              {destinations.length > 0 ? (
                <div className={styles.field}>
                  <select
                    value={destinationId}
                    onChange={(e) => setDestinationId(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">-- {t.wallet?.selectDestination || 'Select'} --</option>
                    {destinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.noDestinationsHint}>
                  {destinationType === 'bank' 
                    ? t.wallet?.noBankCards || 'No bank cards linked'
                    : t.wallet?.noAddresses || 'No addresses linked'
                  }
                </div>
              )}

              {/* Submit button */}
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={!isValid || !hasDestinations}
              >
                {t.wallet?.withdraw || 'Withdraw'}
              </button>
            </>
          )}

          {/* Close button after completion */}
          {pendingWithdraw && pendingWithdraw.status === 'completed' && (
            <button className={styles.doneButton} onClick={handleClose}>
              {t.common?.close || 'Close'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}



