import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useAutomationStore } from '../../store/automationStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { toast } from '../Toast';
import { TriggerType, TriggerOperator, CrossDirection, QuantityMode, TriggerCondition, TriggerAction } from '../../types/automation';
import { OrderSide, OrderType } from '../../types/trading';
import styles from './TriggerForm.module.css';

interface TriggerFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function TriggerForm({ onSuccess, onCancel, compact = false }: TriggerFormProps) {
  const { t } = useI18n();
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const addTrigger = useAutomationStore((state) => state.addTrigger);

  const [triggerType] = useState<TriggerType>('conditional');
  const [operator, setOperator] = useState<TriggerOperator>('gte');
  const [threshold, setThreshold] = useState('');
  const [priceSource, setPriceSource] = useState<TriggerCondition['priceSource']>('last');
  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [quantityMode, setQuantityMode] = useState<QuantityMode>('fixed');
  const [quantityValue, setQuantityValue] = useState('');
  const [allowDegraded, setAllowDegraded] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [cooldown, setCooldown] = useState('60');

  const direction: CrossDirection = operator === 'gte' ? 'up' : 'down';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!threshold || parseFloat(threshold) <= 0) {
      toast.warning('Invalid trigger price');
      return;
    }

    if (!quantityValue || parseFloat(quantityValue) <= 0) {
      toast.warning('Invalid quantity');
      return;
    }

    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast.warning('Invalid limit price');
      return;
    }

    const triggerCondition: TriggerCondition = {
      priceSource,
      operator,
      threshold,
      direction,
      debounceMs: 1000,
      cooldownMs: parseInt(cooldown) * 1000,
    };

    const triggerAction: TriggerAction = {
      type: 'order',
      side,
      orderType,
      limitPrice: orderType === 'limit' ? limitPrice : undefined,
      quantityMode,
      quantityValue,
      timeInForce: 'GTC',
    };

    addTrigger({
      symbol: selectedSymbol,
      type: triggerType,
      enabled: true,
      condition: triggerCondition,
      action: triggerAction,
      allowDegraded,
      repeat,
    });

    toast.success('Trigger created');
    setThreshold('');
    setQuantityValue('');
    setLimitPrice('');
    if (onSuccess) onSuccess();
  };

  const quoteAsset = 'USDT';
  const baseAsset = selectedSymbol.replace('USDT', '');

  if (compact) {
    return (
      <div className={styles.compactContainer}>
        <form onSubmit={handleSubmit} className={styles.compactForm}>
          {/* Row 1: Condition */}
          <div className={styles.compactRow}>
            <div className={styles.compactField}>
              <label className={styles.compactLabel}>When {baseAsset}</label>
              <div className={styles.compactToggle}>
                <button type="button" className={`${styles.compactBtn} ${operator === 'gte' ? styles.active : ''}`} onClick={() => setOperator('gte')}>≥</button>
                <button type="button" className={`${styles.compactBtn} ${operator === 'lte' ? styles.active : ''}`} onClick={() => setOperator('lte')}>≤</button>
              </div>
            </div>
            <div className={styles.compactField} style={{ flex: 1 }}>
              <label className={styles.compactLabel}>Price</label>
              <div className={styles.compactInputWrap}>
                <input type="number" step="any" className={styles.compactInput} value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="0.00" required />
                <span className={styles.compactSuffix}>{quoteAsset}</span>
              </div>
            </div>
            <div className={styles.compactField}>
              <label className={styles.compactLabel}>Source</label>
              <select className={styles.compactSelect} value={priceSource} onChange={(e) => setPriceSource(e.target.value as any)}>
                <option value="last">Last</option>
                <option value="mid">Mid</option>
                <option value="bid">Bid</option>
                <option value="ask">Ask</option>
              </select>
            </div>
          </div>

          {/* Row 2: Action */}
          <div className={styles.compactRow}>
            <div className={styles.compactField}>
              <label className={styles.compactLabel}>Action</label>
              <div className={styles.compactToggle}>
                <button type="button" className={`${styles.compactBtn} ${styles.buyBtn} ${side === 'buy' ? styles.active : ''}`} onClick={() => setSide('buy')}>Buy</button>
                <button type="button" className={`${styles.compactBtn} ${styles.sellBtn} ${side === 'sell' ? styles.active : ''}`} onClick={() => setSide('sell')}>Sell</button>
              </div>
            </div>
            <div className={styles.compactField} style={{ flex: 1 }}>
              <label className={styles.compactLabel}>Amount</label>
              <div className={styles.compactInputWrap}>
                <input type="number" step="any" className={styles.compactInput} value={quantityValue} onChange={(e) => setQuantityValue(e.target.value)} placeholder="0.00" required />
                <span className={styles.compactSuffix}>{quantityMode === 'fixed' ? baseAsset : '%'}</span>
              </div>
            </div>
            <div className={styles.compactField}>
              <label className={styles.compactLabel}>Mode</label>
              <select className={styles.compactSelect} value={quantityMode} onChange={(e) => setQuantityMode(e.target.value as any)}>
                <option value="fixed">Fixed</option>
                <option value="percent">%</option>
              </select>
            </div>
          </div>

          {/* Row 3: Order Type & Options */}
          <div className={styles.compactRow}>
            <div className={styles.compactField}>
              <label className={styles.compactLabel}>Type</label>
              <div className={styles.compactToggle}>
                <button type="button" className={`${styles.compactBtn} ${orderType === 'market' ? styles.active : ''}`} onClick={() => setOrderType('market')}>Mkt</button>
                <button type="button" className={`${styles.compactBtn} ${orderType === 'limit' ? styles.active : ''}`} onClick={() => setOrderType('limit')}>Lmt</button>
              </div>
            </div>
            {orderType === 'limit' && (
              <div className={styles.compactField} style={{ flex: 1 }}>
                <label className={styles.compactLabel}>Limit Price</label>
                <div className={styles.compactInputWrap}>
                  <input type="number" step="any" className={styles.compactInput} value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="0.00" required />
                  <span className={styles.compactSuffix}>{quoteAsset}</span>
                </div>
              </div>
            )}
            <div className={styles.compactOptions}>
              <label className={styles.compactCheckbox}>
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                <span>Repeat</span>
              </label>
              <label className={styles.compactCheckbox}>
                <input type="checkbox" checked={allowDegraded} onChange={(e) => setAllowDegraded(e.target.checked)} />
                <span>Degraded</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" className={`${styles.compactSubmit} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit}`}>
            Create {operator === 'gte' ? '↑' : '↓'} {side.toUpperCase()} Trigger
          </button>
        </form>
      </div>
    );
  }

  // Original full form
  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation?.form?.triggerType || 'Trigger Type'}</label>
          <div className={styles.modeToggle}>
            <button type="button" className={`${styles.toggleBtn} ${operator === 'gte' ? styles.active : ''}`} onClick={() => setOperator('gte')}>
              {t.automation?.form?.priceAbove || 'Price Above'}
            </button>
            <button type="button" className={`${styles.toggleBtn} ${operator === 'lte' ? styles.active : ''}`} onClick={() => setOperator('lte')}>
              {t.automation?.form?.priceBelow || 'Price Below'}
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation?.form?.triggerPrice || 'Trigger Price'}</label>
          <div className={styles.inputWrapper}>
            <input type="number" step="any" className="input" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="0.00" required />
            <span className={styles.inputSuffix}>{quoteAsset}</span>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation?.form?.priceSource || 'Price Source'}</label>
          <select className="input" value={priceSource} onChange={(e) => setPriceSource(e.target.value as any)}>
            <option value="last">Last Price</option>
            <option value="mid">Mid Price</option>
            <option value="bid">Best Bid</option>
            <option value="ask">Best Ask</option>
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation?.form?.side || 'Side'}</label>
          <div className={styles.sideToggle}>
            <button type="button" className={`${styles.toggleBtn} ${side === 'buy' ? `${styles.active} ${styles.buyActive}` : ''}`} onClick={() => setSide('buy')}>
              {t.automation?.form?.buy || 'Buy'}
            </button>
            <button type="button" className={`${styles.toggleBtn} ${side === 'sell' ? `${styles.active} ${styles.sellActive}` : ''}`} onClick={() => setSide('sell')}>
              {t.automation?.form?.sell || 'Sell'}
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation?.form?.orderType || 'Order Type'}</label>
          <div className={styles.typeToggle}>
            <button type="button" className={`${styles.toggleBtn} ${orderType === 'market' ? styles.active : ''}`} onClick={() => setOrderType('market')}>
              {t.orderEntry?.market || 'Market'}
            </button>
            <button type="button" className={`${styles.toggleBtn} ${orderType === 'limit' ? styles.active : ''}`} onClick={() => setOrderType('limit')}>
              {t.orderEntry?.limit || 'Limit'}
            </button>
          </div>
        </div>

        {orderType === 'limit' && (
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t.automation?.form?.limitPrice || 'Limit Price'}</label>
            <div className={styles.inputWrapper}>
              <input type="number" step="any" className="input" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="0.00" required />
              <span className={styles.inputSuffix}>{quoteAsset}</span>
            </div>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <div className={styles.inputRow}>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>{t.automation?.form?.quantity || 'Quantity'}</label>
              <div className={styles.inputWrapper}>
                <input type="number" step="any" className="input" value={quantityValue} onChange={(e) => setQuantityValue(e.target.value)} placeholder="0.00" required />
                <span className={styles.inputSuffix}>{quantityMode === 'fixed' ? baseAsset : '%'}</span>
              </div>
            </div>
            <div style={{ width: '80px' }}>
              <label className={styles.label}>{t.automation?.form?.quantityMode || 'Mode'}</label>
              <select className="input" value={quantityMode} onChange={(e) => setQuantityMode(e.target.value as any)}>
                <option value="fixed">{t.automation?.form?.fixed || 'Fixed'}</option>
                <option value="percent">{t.automation?.form?.percent || '%'}</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" className={styles.checkbox} checked={allowDegraded} onChange={(e) => setAllowDegraded(e.target.checked)} />
            {t.automation?.form?.allowDegraded || 'Allow Degraded'}
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" className={styles.checkbox} checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            {t.automation?.form?.repeat || 'Repeat'}
          </label>
          {repeat && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t.automation?.form?.cooldown || 'Cooldown (s)'}</label>
              <input type="number" className="input" value={cooldown} onChange={(e) => setCooldown(e.target.value)} min="1" />
            </div>
          )}
        </div>

        <button type="submit" className={`${styles.submitBtn} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit}`}>
          {t.automation?.form?.create || 'Create Trigger'}
        </button>

        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t.common?.cancel || 'Cancel'}
          </button>
        )}
      </form>
    </div>
  );
}
