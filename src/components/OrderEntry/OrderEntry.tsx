import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useMarketStore, selectOrderBook, selectMetrics, selectBestBid, selectBestAsk, selectDataConfidence } from '../../store/marketStore';
import { useTradingStore, selectFocusMode } from '../../store/tradingStore';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useI18n, formatMessage } from '../../i18n';
import { toast } from '../Toast';
import { Icon } from '../Icon';
import { QuantitySlider } from './QuantitySlider';
import type { OrderSide, OrderType } from '../../types/trading';
import styles from './OrderEntry.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'buy' | 'sell';
}

function ConfirmModal({ isOpen, title, message, detail, confirmText, cancelText, onConfirm, onCancel, type = 'buy' }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <Icon name="alert-circle" size="sm" className={type === 'buy' ? styles.buyIcon : styles.sellIcon} />
          <h3 className={styles.modalTitle}>{title}</h3>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
          {detail && <p className={styles.modalDetail}>{detail}</p>}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onCancel}>{cancelText}</button>
          <button className={`${styles.modalConfirmBtn} ${type === 'buy' ? styles.buyConfirm : styles.sellConfirm}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

interface OrderEntryProps {
  priceFromOrderBook?: string;
  sideFromOrderBook?: OrderSide;
  compact?: boolean;
}

export function OrderEntry({ priceFromOrderBook, sideFromOrderBook, compact = false }: OrderEntryProps) {
  const { t } = useI18n();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('0');
  const [quantityPercent, setQuantityPercent] = useState(0);
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [showDegradedConfirm, setShowDegradedConfirm] = useState(false);
  const [showAllInConfirm, setShowAllInConfirm] = useState(false);
  
  const orderBook = useMarketStore(selectOrderBook);
  const metrics = useMarketStore(selectMetrics);
  const bestBid = useMarketStore(selectBestBid);
  const bestAsk = useMarketStore(selectBestAsk);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const balances = useWalletStore(selectBalances);
  const focusMode = useTradingStore(selectFocusMode);
  const createOrder = useTradingStore((state) => state.createOrder);
  const setFocusMode = useTradingStore((state) => state.setFocusMode);
  
  const priceInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const slInputRef = useRef<HTMLInputElement>(null);
  const isInputFocused = useRef(false);
  const activeInputRef = useRef<'price' | 'quantity' | 'tp' | 'sl' | null>(null);

  const symbol = orderBook?.symbol ?? 'BTCUSDT';
  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = 'USDT';
  const baseBalance = balances.find(b => b.asset === baseAsset);
  const quoteBalance = balances.find(b => b.asset === quoteAsset);

  useEffect(() => {
    if (priceFromOrderBook) setPrice(priceFromOrderBook);
    if (sideFromOrderBook) setSide(sideFromOrderBook);
  }, [priceFromOrderBook, sideFromOrderBook]);

  useEffect(() => {
    if (type === 'limit' && price && quantity) {
      const p = parseFloat(price);
      const q = parseFloat(quantity);
      setTotal(!isNaN(p) && !isNaN(q) ? (p * q).toFixed(2) : '0');
    } else if (type === 'market' && quantity && metrics) {
      const q = parseFloat(quantity);
      const mid = parseFloat(metrics.mid);
      setTotal(!isNaN(q) && !isNaN(mid) ? (mid * q).toFixed(2) : '0');
    } else setTotal('0');
  }, [price, quantity, type, metrics]);

  const getMaxQuantity = useCallback(() => {
    if (side === 'buy' && quoteBalance && metrics) {
      const av = parseFloat(quoteBalance.available);
      const p = type === 'limit' && price ? parseFloat(price) : parseFloat(metrics.mid);
      return p > 0 ? av / p : 0;
    } else if (side === 'sell' && baseBalance) return parseFloat(baseBalance.available);
    return 0;
  }, [side, type, price, quoteBalance, baseBalance, metrics]);

  const updateQuantityFromPercent = useCallback((pct: number) => {
    const max = getMaxQuantity();
    if (max > 0) setQuantity((max * pct / 100).toFixed(6));
  }, [getMaxQuantity]);

  useEffect(() => {
    const max = getMaxQuantity();
    if (max > 0 && quantity) {
      const pct = Math.round((parseFloat(quantity) / max) * 100);
      setQuantityPercent(Math.min(100, Math.max(0, pct)));
    } else setQuantityPercent(0);
  }, [quantity, getMaxQuantity]);

  const setFromBestBid = () => { if (bestBid) { setPrice(bestBid.price); setSide('buy'); } };
  const setFromBestAsk = () => { if (bestAsk) { setPrice(bestAsk.price); setSide('sell'); } };
  const setFromMid = () => { if (metrics) setPrice(metrics.mid); };

  const handleStepUp = useCallback(() => {
    if (price) {
      const p = parseFloat(price);
      if (!isNaN(p)) {
        const step = p >= 1 ? 0.01 : 0.0001;
        setPrice((p + step).toFixed(p >= 1 ? 2 : 4));
      }
    }
  }, [price]);

  const handleStepDown = useCallback(() => {
    if (price) {
      const p = parseFloat(price);
      if (!isNaN(p)) {
        const step = p >= 1 ? 0.01 : 0.0001;
        setPrice(Math.max(0, p - step).toFixed(p >= 1 ? 2 : 4));
      }
    }
  }, [price]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === priceInputRef.current) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handleStepUp(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); handleStepDown(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStepUp, handleStepDown]);

  const handleInputFocus = (inputName: 'price' | 'quantity' | 'tp' | 'sl') => () => { 
    isInputFocused.current = true; 
    activeInputRef.current = inputName;
    setFocusMode(true); 
  };
  const handleInputBlur = () => { 
    isInputFocused.current = false; 
    setTimeout(() => { 
      if (!isInputFocused.current) {
        setFocusMode(false);
        activeInputRef.current = null;
      }
    }, 100); 
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dataConfidence.level === 'stale') { toast.warning(t.dataConfidence.staleDesc); return; }
    if (dataConfidence.level === 'degraded' && !showDegradedConfirm) { setShowDegradedConfirm(true); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.warning(t.orderEntry.invalidAmount); return; }
    if (type === 'limit' && (!price || parseFloat(price) <= 0)) { toast.warning(t.orderEntry.invalidPrice); return; }

    const order = createOrder({
      symbol, side, type,
      price: type === 'limit' ? price : undefined,
      quantity,
      takeProfitPrice: takeProfitPrice || undefined,
      stopLossPrice: stopLossPrice || undefined,
    }, metrics?.mid);

    if (order) {
      toast.success(t.toast.orderSubmitted);
      setQuantity(''); setQuantityPercent(0); setTakeProfitPrice(''); setStopLossPrice('');
      if (type === 'limit') setPrice('');
      setShowDegradedConfirm(false); setFocusMode(false);
    } else toast.error(t.orderEntry.insufficientBalance);
  };
  
  const isSubmitDisabled = dataConfidence.level === 'stale' || dataConfidence.level === 'resyncing' || !quantity || (type === 'limit' && !price);
  const estimatedPriceValue = type === 'market' && metrics ? metrics.mid : (type === 'limit' ? price : '—');
  const slippageEst = metrics?.slippageEst && metrics.slippageEst !== 'N/A' ? `${metrics.slippageEst}bp` : '—';
  const feeValue = total !== '0' ? (parseFloat(total) * 0.001).toFixed(2) : '0';

  return (
    <div className={`card ${styles.container} ${focusMode ? styles.focused : ''} animate-fade`}>
      <div className="card-header">
        <span className="card-title">{t.orderEntry.title}</span>
        {focusMode && <span className={styles.focusBadge}>Focus</span>}
      </div>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Combined Side & Type Toggle Row */}
        <div className={styles.headerRow}>
          <div className={styles.sideToggle}>
            <button type="button" className={`${styles.sideBtn} ${styles.buyBtn} ${side === 'buy' ? styles.active : ''}`} onClick={() => setSide('buy')}>{t.orderEntry.buy}</button>
            <button type="button" className={`${styles.sideBtn} ${styles.sellBtn} ${side === 'sell' ? styles.active : ''}`} onClick={() => setSide('sell')}>{t.orderEntry.sell}</button>
          </div>
          <div className={styles.typeToggle}>
            <button type="button" className={`${styles.typeBtn} ${type === 'limit' ? styles.active : ''}`} onClick={() => setType('limit')}>{t.orderEntry.limit}</button>
            <button type="button" className={`${styles.typeBtn} ${type === 'market' ? styles.active : ''}`} onClick={() => setType('market')}>{t.orderEntry.market}</button>
          </div>
        </div>

        {/* Price Input (Limit only) */}
        {type === 'limit' && (
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t.orderEntry.price}</label>
            <div className={styles.inputWrapper}>
              <button type="button" className={styles.stepBtn} onClick={handleStepDown}><Icon name="minus" size="xs" /></button>
              <input ref={priceInputRef} type="text" inputMode="decimal" className={`input ${styles.input}`} value={price} onChange={(e) => setPrice(e.target.value)} onFocus={handleInputFocus('price')} onBlur={handleInputBlur} placeholder="0.00" />
              <button type="button" className={styles.stepBtn} onClick={handleStepUp}><Icon name="plus" size="xs" /></button>
              <span className={styles.inputSuffix}>{quoteAsset}</span>
            </div>
            <div className={styles.quickFillButtons}>
              <button type="button" className={styles.quickFillBtn} onClick={setFromBestBid}>{t.orderEntry.bid1}</button>
              <button type="button" className={styles.quickFillBtn} onClick={setFromMid}>{t.orderEntry.mid}</button>
              <button type="button" className={styles.quickFillBtn} onClick={setFromBestAsk}>{t.orderEntry.ask1}</button>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>{t.orderEntry.amount}</label>
          <div className={styles.inputWrapper}>
            <input ref={quantityInputRef} type="text" inputMode="decimal" className={`input ${styles.input}`} value={quantity} onChange={(e) => setQuantity(e.target.value)} onFocus={handleInputFocus('quantity')} onBlur={handleInputBlur} placeholder="0.00" style={{ paddingRight: '48px' }} />
            <span className={styles.inputSuffix} style={{ right: '8px' }}>{baseAsset}</span>
          </div>
          <div className={styles.sliderRow}>
            <div className={styles.sliderContainer}>
              <QuantitySlider value={quantityPercent} onChange={(p) => { setQuantityPercent(p); updateQuantityFromPercent(p); }} estimatedQty={quantity || '0'} />
            </div>
            <div className={styles.percentButtons}>
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} type="button" className={styles.percentBtn} onClick={() => updateQuantityFromPercent(pct)}>{pct}%</button>
              ))}
            </div>
          </div>
        </div>

        {/* TP/SL Compact */}
        <div className={styles.tpslContainer}>
          <div className={styles.inputGroupSmall}>
            <label className={styles.labelSmall}>{t.orderEntry.takeProfit}</label>
            <input ref={tpInputRef} type="text" inputMode="decimal" className={`input ${styles.inputSmall}`} value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} onFocus={handleInputFocus('tp')} onBlur={handleInputBlur} placeholder="—" />
          </div>
          <div className={styles.inputGroupSmall}>
            <label className={styles.labelSmall}>{t.orderEntry.stopLoss}</label>
            <input ref={slInputRef} type="text" inputMode="decimal" className={`input ${styles.inputSmall}`} value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} onFocus={handleInputFocus('sl')} onBlur={handleInputBlur} placeholder="—" />
          </div>
        </div>

        {/* Compact Estimated Info */}
        <div className={styles.estimatedInfo}>
          <div className={styles.estimatedRow}>
            <span className={styles.estimatedLabel}>{t.orderEntry.estimatedPrice}</span>
            <span className={`${styles.estimatedValue} tabular-nums`}>{estimatedPriceValue || '—'}</span>
          </div>
          <div className={styles.estimatedRow}>
            <span className={styles.estimatedLabel}>{t.orderEntry.slippage}</span>
            <span className={`${styles.estimatedValue} tabular-nums`}>{slippageEst}</span>
          </div>
          <div className={styles.estimatedRow}>
            <span className={styles.estimatedLabel}>{t.orderEntry.fee}</span>
            <span className={`${styles.estimatedValue} tabular-nums`}>{feeValue}</span>
          </div>
        </div>

        {/* Total & Available */}
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>{t.orderEntry.total}</span>
          <span className={`${styles.totalValue} tabular-nums`}>{total} {quoteAsset}</span>
        </div>

        <div className={styles.balanceRow}>
          <span className={styles.balanceLabel}>{t.orderEntry.available}</span>
          <span className={`${styles.balanceValue} tabular-nums`}>
            {side === 'buy' ? `${parseFloat(quoteBalance?.available ?? '0').toFixed(2)} ${quoteAsset}` : `${parseFloat(baseBalance?.available ?? '0').toFixed(6)} ${baseAsset}`}
          </span>
        </div>

        {/* Data Confidence Warning */}
        {dataConfidence.level !== 'live' && (
          <div className={`${styles.confidenceWarning} ${styles[dataConfidence.level]}`}>
            <div className={styles.warningBar} />
            <Icon name="alert-triangle" size="xs" />
            <span className={styles.warningText}>{dataConfidence.reason}</span>
          </div>
        )}

        {/* Degraded Confirm */}
        {showDegradedConfirm && (
          <div className={styles.degradedConfirm}>
            <p className={styles.confirmText}>{t.orderEntry.confirmDegraded}</p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmBtn} onClick={() => { setShowDegradedConfirm(false); handleSubmit({ preventDefault: () => {} } as React.FormEvent); }}>{t.common.confirm}</button>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowDegradedConfirm(false)}>{t.common.cancel}</button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button type="submit" className={`btn ${styles.submitBtn} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit}`} disabled={isSubmitDisabled}>
          {side === 'buy' ? formatMessage(t.orderEntry.placeBuyOrder, { symbol: baseAsset }) : formatMessage(t.orderEntry.placeSellOrder, { symbol: baseAsset })}
        </button>

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <button type="button" className={`${styles.quickBtn} ${side === 'buy' ? styles.allInBuyBtn : styles.allInSellBtn}`} onClick={() => setShowAllInConfirm(true)} disabled={!metrics}>
            {side === 'buy' ? (t.orderEntry.allInBuy || 'All-In Buy') : (t.orderEntry.allInSell || 'Sell All')}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showAllInConfirm}
        title={side === 'buy' ? (t.orderEntry.confirmAllInBuyTitle || 'Confirm All-In') : (t.orderEntry.confirmAllInSellTitle || 'Confirm Sell All')}
        message={side === 'buy' ? (t.orderEntry.confirmAllInBuyMessage || `Use all available ${quoteAsset} to buy ${baseAsset}`) : (t.orderEntry.confirmAllInSellMessage || `Sell all holdings of ${baseAsset}`)}
        detail={side === 'buy' ? `${parseFloat(quoteBalance?.available ?? '0').toFixed(2)} ${quoteAsset} → ${baseAsset}` : `${parseFloat(baseBalance?.available ?? '0').toFixed(6)} ${baseAsset} → ${quoteAsset}`}
        confirmText={side === 'buy' ? (t.orderEntry.confirmAllInBuy || 'Confirm Buy') : (t.orderEntry.confirmAllInSell || 'Confirm Sell')}
        cancelText={t.common.cancel}
        onConfirm={() => { setShowAllInConfirm(false); updateQuantityFromPercent(100); if (type === 'limit' && !price && metrics) setPrice(side === 'buy' ? bestAsk?.price || metrics.mid : bestBid?.price || metrics.mid); }}
        onCancel={() => setShowAllInConfirm(false)}
        type={side}
      />
    </div>
  );
}
