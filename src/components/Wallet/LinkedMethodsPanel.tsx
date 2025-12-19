import { useState } from 'react';
import { useWalletStore, selectPaymentMethods, selectCryptoAddresses } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import type { ChainType } from '../../types/wallet';
import styles from './LinkedMethodsPanel.module.css';

interface LinkedMethodsPanelProps {
  highlightAdd?: boolean;
}

export function LinkedMethodsPanel({ highlightAdd }: LinkedMethodsPanelProps) {
  const { t } = useI18n();
  const paymentMethods = useWalletStore(selectPaymentMethods);
  const cryptoAddresses = useWalletStore(selectCryptoAddresses);
  const addPaymentMethod = useWalletStore((state) => state.addPaymentMethod);
  const removePaymentMethod = useWalletStore((state) => state.removePaymentMethod);
  const addCryptoAddress = useWalletStore((state) => state.addCryptoAddress);
  const removeCryptoAddress = useWalletStore((state) => state.removeCryptoAddress);

  const [showAddBank, setShowAddBank] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);

  // Bank card form state
  const [bankName, setBankName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [bankAlias, setBankAlias] = useState('');

  // Crypto address form state
  const [chain, setChain] = useState<ChainType>('TRC20');
  const [address, setAddress] = useState('');
  const [addressAlias, setAddressAlias] = useState('');

  const handleAddBank = () => {
    if (!bankName || !lastFour || lastFour.length !== 4) return;
    addPaymentMethod(bankName, lastFour, bankAlias || `${bankName} ****${lastFour}`);
    setBankName('');
    setLastFour('');
    setBankAlias('');
    setShowAddBank(false);
  };

  const handleAddAddress = () => {
    if (!address || address.length < 10) return;
    addCryptoAddress(chain, address, addressAlias || `${chain}: ${address.slice(0, 8)}...`);
    setChain('TRC20');
    setAddress('');
    setAddressAlias('');
    setShowAddAddress(false);
  };

  const handleDeleteBank = (id: string) => {
    if (confirm(t.wallet?.deleteConfirm || 'Are you sure you want to delete this?')) {
      removePaymentMethod(id);
    }
  };

  const handleDeleteAddress = (id: string) => {
    if (confirm(t.wallet?.deleteConfirm || 'Are you sure you want to delete this?')) {
      removeCryptoAddress(id);
    }
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">
        <Icon name="link" size="sm" />
        <span>{t.wallet?.linkedMethods || 'Linked Methods'}</span>
      </div>

      <div className={styles.content}>
        {/* Bank Cards Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon name="building-2" size="sm" />
            <span>{t.wallet?.bankCards || 'Bank Cards'}</span>
          </div>

          {paymentMethods.length === 0 ? (
            <div className={styles.emptyText}>
              {t.wallet?.noBankCards || 'No bank cards linked'}
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {paymentMethods.map((method) => (
                <div key={method.id} className={styles.bankCard}>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.cardDeleteButton}
                      onClick={() => handleDeleteBank(method.id)}
                      title={t.wallet?.delete || 'Delete'}
                    >
                      <Icon name="trash-2" size="sm" />
                    </button>
                  </div>
                  <div className={styles.cardChip} />
                  <div className={styles.bankBrand}>{method.bankName}</div>
                  <div className={styles.cardNumber}>
                    **** **** **** {method.lastFour}
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={styles.cardHolder}>
                      <span className={styles.cardHolderLabel}>{t.wallet?.cardHolder || 'Cardholder'}</span>
                      <span className={styles.cardHolderName}>{method.alias || 'Valued Customer'}</span>
                    </div>
                    <div className={styles.cardType}>
                      <Icon name="credit-card" size="md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddBank ? (
            <div className={styles.addForm}>
              <div className={styles.formGrid}>
                <input
                  type="text"
                  placeholder={t.wallet?.bankName || 'Bank Name (e.g. JPMorgan)'}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={styles.input}
                />
                <input
                  type="text"
                  placeholder={t.wallet?.lastFourDigits || 'Last 4 Digits'}
                  value={lastFour}
                  onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className={styles.input}
                  maxLength={4}
                />
              </div>
              <input
                type="text"
                placeholder={t.wallet?.cardHolder || 'Cardholder Name'}
                value={bankAlias}
                onChange={(e) => setBankAlias(e.target.value)}
                className={styles.input}
              />
              <div className={styles.formActions}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowAddBank(false)}
                >
                  {t.common?.cancel || 'Cancel'}
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handleAddBank}
                  disabled={!bankName || lastFour.length !== 4}
                >
                  {t.common?.confirm || 'Add Card'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className={`${styles.addButton} ${highlightAdd ? styles.highlighted : ''}`}
              onClick={() => setShowAddBank(true)}
            >
              <Icon name="plus" size="sm" />
              <span>{t.wallet?.addBankCard || 'Add Bank Card'}</span>
            </button>
          )}
        </div>

        {/* Crypto Addresses Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon name="wallet" size="sm" />
            <span>{t.wallet?.cryptoAddresses || 'Crypto Addresses'}</span>
          </div>

          {cryptoAddresses.length === 0 ? (
            <div className={styles.emptyText}>
              {t.wallet?.noAddresses || 'No addresses linked'}
            </div>
          ) : (
            <div className={styles.itemList}>
              {cryptoAddresses.map((addr) => (
                <div key={addr.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.chainBadge}>{addr.chain}</span>
                    <span className={styles.addressText}>{truncateAddress(addr.address)}</span>
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteAddress(addr.id)}
                    title={t.wallet?.delete || 'Delete'}
                  >
                    <Icon name="trash-2" size="sm" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddAddress ? (
            <div className={styles.addForm}>
              <div className={styles.formGrid}>
                <select
                  value={chain}
                  onChange={(e) => setChain(e.target.value as ChainType)}
                  className={styles.select}
                >
                  <option value="TRC20">TRC20</option>
                  <option value="ERC20">ERC20</option>
                  <option value="BEP20">BEP20</option>
                </select>
                <input
                  type="text"
                  placeholder={t.wallet?.alias || 'Alias (e.g. My Ledger)'}
                  value={addressAlias}
                  onChange={(e) => setAddressAlias(e.target.value)}
                  className={styles.input}
                />
              </div>
              <input
                type="text"
                placeholder={t.wallet?.address || 'Deposit Address'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={styles.input}
              />
              <div className={styles.formActions}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowAddAddress(false)}
                >
                  {t.common?.cancel || 'Cancel'}
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handleAddAddress}
                  disabled={address.length < 10}
                >
                  {t.common?.confirm || 'Add Address'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className={`${styles.addButton} ${highlightAdd ? styles.highlighted : ''}`}
              onClick={() => setShowAddAddress(true)}
            >
              <Icon name="plus" size="sm" />
              <span>{t.wallet?.addAddress || 'Add Address'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


