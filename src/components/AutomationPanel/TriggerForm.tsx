import React, { useState, useEffect } from 'react';
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
}

export function TriggerForm({ onSuccess, onCancel }: TriggerFormProps) {
  const { t } = useI18n();
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const addTrigger = useAutomationStore((state) => state.addTrigger);

  // Form State
  const [triggerType, setTriggerType] = useState<TriggerType>('conditional');
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

  // Derived direction
  const direction: CrossDirection = operator === 'gte' ? 'up' : 'down';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!threshold || parseFloat(threshold) <= 0) {
      toast.warning(t.automation.form.triggerPrice + ' ' + t.common.error);
      return;
    }

    if (!quantityValue || parseFloat(quantityValue) <= 0) {
      toast.warning(t.automation.form.quantity + ' ' + t.common.error);
      return;
    }

    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast.warning(t.automation.form.limitPrice + ' ' + t.common.error);
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
      condition: triggerCondition,
      action: triggerAction,
      allowDegraded,
      repeat,
    });

    toast.success(t.common.success);
    if (onSuccess) onSuccess();
  };

  const quoteAsset = 'USDT';
  const baseAsset = selectedSymbol.replace('USDT', '');

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Trigger Type Toggle */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation.form.triggerType}</label>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${operator === 'gte' ? styles.active : ''}`}
              onClick={() => setOperator('gte')}
            >
              {t.automation.form.priceAbove}
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${operator === 'lte' ? styles.active : ''}`}
              onClick={() => setOperator('lte')}
            >
              {t.automation.form.priceBelow}
            </button>
          </div>
        </div>

        {/* Threshold Price */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation.form.triggerPrice}</label>
          <div className={styles.inputWrapper}>
            <input
              type="number"
              step="any"
              className="input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0.00"
              required
            />
            <span className={styles.inputSuffix}>{quoteAsset}</span>
          </div>
        </div>

        {/* Price Source */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation.form.priceSource}</label>
          <select
            className="input"
            value={priceSource}
            onChange={(e) => setPriceSource(e.target.value as any)}
          >
            <option value="last">Last Price</option>
            <option value="mid">Mid Price</option>
            <option value="bid">Best Bid</option>
            <option value="ask">Best Ask</option>
          </select>
        </div>

        {/* Order Side */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation.form.side}</label>
          <div className={styles.sideToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${side === 'buy' ? `${styles.active} ${styles.buyActive}` : ''}`}
              onClick={() => setSide('buy')}
            >
              {t.automation.form.buy}
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${side === 'sell' ? `${styles.active} ${styles.sellActive}` : ''}`}
              onClick={() => setSide('sell')}
            >
              {t.automation.form.sell}
            </button>
          </div>
        </div>

        {/* Order Type */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t.automation.form.orderType}</label>
          <div className={styles.typeToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${orderType === 'market' ? styles.active : ''}`}
              onClick={() => setOrderType('market')}
            >
              {t.orderEntry.market}
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${orderType === 'limit' ? styles.active : ''}`}
              onClick={() => setOrderType('limit')}
            >
              {t.orderEntry.limit}
            </button>
          </div>
        </div>

        {/* Limit Price */}
        {orderType === 'limit' && (
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t.automation.form.limitPrice}</label>
            <div className={styles.inputWrapper}>
              <input
                type="number"
                step="any"
                className="input"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0.00"
                required
              />
              <span className={styles.inputSuffix}>{quoteAsset}</span>
            </div>
          </div>
        )}

        {/* Quantity Mode and Value */}
        <div className={styles.fieldGroup}>
          <div className={styles.inputRow}>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>{t.automation.form.quantity}</label>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  step="any"
                  className="input"
                  value={quantityValue}
                  onChange={(e) => setQuantityValue(e.target.value)}
                  placeholder="0.00"
                  required
                />
                <span className={styles.inputSuffix}>
                  {quantityMode === 'fixed' ? baseAsset : '%'}
                </span>
              </div>
            </div>
            <div style={{ width: '80px' }}>
              <label className={styles.label}>{t.automation.form.quantityMode}</label>
              <select
                className="input"
                value={quantityMode}
                onChange={(e) => setQuantityMode(e.target.value as any)}
              >
                <option value="fixed">{t.automation.form.fixed}</option>
                <option value="percent">{t.automation.form.percent}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={allowDegraded}
              onChange={(e) => setAllowDegraded(e.target.checked)}
            />
            {t.automation.form.allowDegraded}
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            {t.automation.form.repeat}
          </label>
          {repeat && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t.automation.form.cooldown}</label>
              <input
                type="number"
                className="input"
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value)}
                min="1"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className={`${styles.submitBtn} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit}`}
        >
          {t.automation.form.create}
        </button>

        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t.common.cancel}
          </button>
        )}
      </form>
    </div>
  );
}

