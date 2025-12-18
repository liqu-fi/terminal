import { useState, useCallback, useEffect, useRef } from 'react';
import { useMarketStore, selectOrderBook, selectMetrics, selectBestBid, selectBestAsk, selectDataConfidence, selectCanTrade } from '../../store/marketStore';
import { useTradingStore, selectBalances, selectFocusMode } from '../../store/tradingStore';
import { useI18n, formatMessage } from '../../i18n';
import { toast } from '../Toast';
import { Icon } from '../Icon';
import { QuantitySlider } from './QuantitySlider';
import type { OrderSide, OrderType } from '../../types/trading';
import styles from './OrderEntry.module.css';

// 确认弹窗组件
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
          <Icon name="alert-circle" size="md" className={type === 'buy' ? styles.buyIcon : styles.sellIcon} />
          <h3 className={styles.modalTitle}>{title}</h3>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
          {detail && <p className={styles.modalDetail}>{detail}</p>}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`${styles.modalConfirmBtn} ${type === 'buy' ? styles.buyConfirm : styles.sellConfirm}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrderEntryProps {
  priceFromOrderBook?: string;
  sideFromOrderBook?: OrderSide;
}

export function OrderEntry({ priceFromOrderBook, sideFromOrderBook }: OrderEntryProps) {
  const { t } = useI18n();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('0');
  const [quantityPercent, setQuantityPercent] = useState(0);
  const [showDegradedConfirm, setShowDegradedConfirm] = useState(false);
  const [showAllInConfirm, setShowAllInConfirm] = useState(false);
  
  const orderBook = useMarketStore(selectOrderBook);
  const metrics = useMarketStore(selectMetrics);
  const bestBid = useMarketStore(selectBestBid);
  const bestAsk = useMarketStore(selectBestAsk);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const canTrade = useMarketStore(selectCanTrade);
  const balances = useTradingStore(selectBalances);
  const focusMode = useTradingStore(selectFocusMode);
  const createOrder = useTradingStore((state) => state.createOrder);
  const setFocusMode = useTradingStore((state) => state.setFocusMode);
  
  const priceInputRef = useRef<HTMLInputElement>(null);
  const isInputFocused = useRef(false);

  // Get current symbol's assets
  const symbol = orderBook?.symbol ?? 'BTCUSDT';
  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = 'USDT';

  // Get balances
  const baseBalance = balances.find(b => b.asset === baseAsset);
  const quoteBalance = balances.find(b => b.asset === quoteAsset);

  // Accept price and side from order book click
  useEffect(() => {
    if (priceFromOrderBook) {
      setPrice(priceFromOrderBook);
    }
    if (sideFromOrderBook) {
      setSide(sideFromOrderBook);
    }
  }, [priceFromOrderBook, sideFromOrderBook]);

  // Calculate total when price or quantity changes
  useEffect(() => {
    if (type === 'limit' && price && quantity) {
      const priceNum = parseFloat(price);
      const qtyNum = parseFloat(quantity);
      if (!isNaN(priceNum) && !isNaN(qtyNum)) {
        setTotal((priceNum * qtyNum).toFixed(2));
      } else {
        setTotal('0');
      }
    } else if (type === 'market' && quantity && metrics) {
      const qtyNum = parseFloat(quantity);
      const midPrice = parseFloat(metrics.mid);
      if (!isNaN(qtyNum) && !isNaN(midPrice)) {
        setTotal((midPrice * qtyNum).toFixed(2));
      } else {
        setTotal('0');
      }
    } else {
      setTotal('0');
    }
  }, [price, quantity, type, metrics]);

  // Update quantity when percent changes
  useEffect(() => {
    if (quantityPercent > 0) {
      setQuantityPercent(quantityPercent);
      updateQuantityFromPercent(quantityPercent);
    }
  }, [quantityPercent]);

  // Calculate max quantity
  const getMaxQuantity = useCallback(() => {
    if (side === 'buy' && quoteBalance && metrics) {
      const available = parseFloat(quoteBalance.free);
      const priceToUse = type === 'limit' && price 
        ? parseFloat(price) 
        : parseFloat(metrics.mid);
      return priceToUse > 0 ? available / priceToUse : 0;
    } else if (side === 'sell' && baseBalance) {
      return parseFloat(baseBalance.free);
    }
    return 0;
  }, [side, type, price, quoteBalance, baseBalance, metrics]);

  // Update quantity from percent
  const updateQuantityFromPercent = useCallback((percent: number) => {
    const maxQty = getMaxQuantity();
    if (maxQty > 0) {
      setQuantity((maxQty * percent / 100).toFixed(6));
    }
  }, [getMaxQuantity]);

  // Update percent when quantity changes manually
  useEffect(() => {
    const maxQty = getMaxQuantity();
    if (maxQty > 0 && quantity) {
      const qtyNum = parseFloat(quantity);
      const percent = Math.round((qtyNum / maxQty) * 100);
      setQuantityPercent(Math.min(100, Math.max(0, percent)));
    } else {
      setQuantityPercent(0);
    }
  }, [quantity, getMaxQuantity]);

  // Quick fill handlers
  const setFromBestBid = useCallback(() => {
    if (bestBid) {
      setPrice(bestBid.price);
      setSide('buy');
    }
  }, [bestBid]);

  const setFromBestAsk = useCallback(() => {
    if (bestAsk) {
      setPrice(bestAsk.price);
      setSide('sell');
    }
  }, [bestAsk]);

  const setFromMid = useCallback(() => {
    if (metrics) {
      setPrice(metrics.mid);
    }
  }, [metrics]);

  // Step control handlers
  const handleStepUp = useCallback(() => {
    if (price) {
      const priceNum = parseFloat(price);
      if (!isNaN(priceNum)) {
        // Simple step: 0.01 for prices > 1, 0.0001 for prices < 1
        const step = priceNum >= 1 ? 0.01 : 0.0001;
        setPrice((priceNum + step).toFixed(priceNum >= 1 ? 2 : 4));
      }
    }
  }, [price]);

  const handleStepDown = useCallback(() => {
    if (price) {
      const priceNum = parseFloat(price);
      if (!isNaN(priceNum)) {
        const step = priceNum >= 1 ? 0.01 : 0.0001;
        const newPrice = Math.max(0, priceNum - step);
        setPrice(newPrice.toFixed(priceNum >= 1 ? 2 : 4));
      }
    }
  }, [price]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === priceInputRef.current) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleStepUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleStepDown();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStepUp, handleStepDown]);

  // Focus mode handlers
  const handleInputFocus = () => {
    isInputFocused.current = true;
    setFocusMode(true);
  };

  const handleInputBlur = () => {
    isInputFocused.current = false;
    setTimeout(() => {
      if (!isInputFocused.current) {
        setFocusMode(false);
      }
    }, 100);
  };

  // Submit order
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 状态联动：STALE 禁用
    if (dataConfidence.level === 'stale') {
      toast.warning(t.dataConfidence.staleDesc);
      return;
    }
    
    // 状态联动：DEGRADED 二次确认
    if (dataConfidence.level === 'degraded' && !showDegradedConfirm) {
      setShowDegradedConfirm(true);
      return;
    }
    
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.warning(t.orderEntry.invalidAmount);
      return;
    }

    if (type === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast.warning(t.orderEntry.invalidPrice);
      return;
    }

    // 传入当前市场价格（用于市价单估算）
    const currentMarketPrice = metrics?.mid;
    
    const order = createOrder({
      symbol,
      side,
      type,
      price: type === 'limit' ? price : undefined,
      quantity,
    }, currentMarketPrice);

    if (order) {
      toast.success(t.toast.orderSubmitted);
      setQuantity('');
      setQuantityPercent(0);
      if (type === 'limit') {
        setPrice('');
      }
      setShowDegradedConfirm(false);
      setFocusMode(false);
    } else {
      toast.error(t.orderEntry.insufficientBalance);
    }
  };
  
  // Button disabled state
  const isSubmitDisabled = 
    dataConfidence.level === 'stale' || 
    dataConfidence.level === 'resyncing' ||
    !quantity || 
    (type === 'limit' && !price);

  // Percentage buttons
  const setQuantityPercentBtn = (percent: number) => {
    updateQuantityFromPercent(percent);
  };

  // Estimated info
  const estimatedPrice = type === 'market' && metrics 
    ? metrics.mid 
    : (type === 'limit' ? price : '—');
  
  const slippageEst = metrics?.slippageEst && metrics.slippageEst !== 'N/A'
    ? `${metrics.slippageEst} bps`
    : '—';
  
  const fee = total !== '0' ? (parseFloat(total) * 0.001).toFixed(2) : '0';

  return (
    <div className={`card ${styles.container} ${focusMode ? styles.focused : ''}`}>
      <div className="card-header">
        {t.orderEntry.title}
        {focusMode && (
          <span className={styles.focusBadge}>
            {t.orderEntry.focusMode}
          </span>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Side Toggle */}
        <div className={styles.sideToggle}>
          <button
            type="button"
            className={`${styles.sideBtn} ${styles.buyBtn} ${side === 'buy' ? styles.active : ''}`}
            onClick={() => setSide('buy')}
          >
            {t.orderEntry.buy}
          </button>
          <button
            type="button"
            className={`${styles.sideBtn} ${styles.sellBtn} ${side === 'sell' ? styles.active : ''}`}
            onClick={() => setSide('sell')}
          >
            {t.orderEntry.sell}
          </button>
        </div>

        {/* Type Toggle */}
        <div className={styles.typeToggle}>
          <button
            type="button"
            className={`${styles.typeBtn} ${type === 'limit' ? styles.active : ''}`}
            onClick={() => setType('limit')}
          >
            {t.orderEntry.limit}
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${type === 'market' ? styles.active : ''}`}
            onClick={() => setType('market')}
          >
            {t.orderEntry.market}
          </button>
        </div>

        {/* Price Input (Limit only) */}
        {type === 'limit' && (
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t.orderEntry.price}</label>
            <div className={styles.inputWrapper}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={handleStepDown}
                aria-label={t.orderEntry.stepDown}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6h8" />
                </svg>
              </button>
              <input
                ref={priceInputRef}
                type="text"
                className={`input ${styles.input}`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={t.orderEntry.pricePlaceholder || '0.00'}
              />
              <button
                type="button"
                className={styles.stepBtn}
                onClick={handleStepUp}
                aria-label={t.orderEntry.stepUp}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2v8M2 6h8" />
                </svg>
              </button>
              <span className={styles.inputSuffix}>{quoteAsset}</span>
            </div>
            <div className={styles.quickFillButtons}>
              <button type="button" className={styles.quickFillBtn} onClick={setFromBestBid}>
                {t.orderEntry.bid1}
              </button>
              <button type="button" className={styles.quickFillBtn} onClick={setFromMid}>
                {t.orderEntry.mid}
              </button>
              <button type="button" className={styles.quickFillBtn} onClick={setFromBestAsk}>
                {t.orderEntry.ask1}
              </button>
            </div>
          </div>
        )}

        {/* Quantity Input */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>{t.orderEntry.amount}</label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              className={`input ${styles.input}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={t.orderEntry.amountPlaceholder || '0.00'}
            />
            <span className={styles.inputSuffix}>{baseAsset}</span>
          </div>
          <QuantitySlider
            value={quantityPercent}
            onChange={(percent) => {
              setQuantityPercent(percent);
              updateQuantityFromPercent(percent);
            }}
            estimatedQty={quantity || '0'}
          />
          <div className={styles.percentButtons}>
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                className={styles.percentBtn}
                onClick={() => setQuantityPercentBtn(pct)}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Info */}
        <div className={styles.estimatedInfo}>
          <div className={styles.estimatedRow}>
            <span className={styles.estimatedLabel}>{t.orderEntry.estimatedPrice}</span>
            <span className={`${styles.estimatedValue} tabular-nums`}>{estimatedPrice}</span>
          </div>
          <div className={styles.estimatedRow}>
            <span className={styles.estimatedLabel}>{t.orderEntry.slippage}</span>
            <span className={`${styles.estimatedValue} tabular-nums`}>{slippageEst}</span>
          </div>
          <div className={styles.estimatedRow}>
            <span className={styles.estimatedLabel}>{t.orderEntry.fee}</span>
            <span className={`${styles.estimatedValue} tabular-nums`}>{fee} {quoteAsset}</span>
          </div>
        </div>

        {/* Total */}
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>{t.orderEntry.total}</span>
          <span className={`${styles.totalValue} tabular-nums`}>
            {total} {quoteAsset}
          </span>
        </div>

        {/* Available Balance */}
        <div className={styles.balanceRow}>
          <span className={styles.balanceLabel}>{t.orderEntry.available}</span>
          <span className={`${styles.balanceValue} tabular-nums`}>
            {side === 'buy' 
              ? `${parseFloat(quoteBalance?.free ?? '0').toFixed(2)} ${quoteAsset}`
              : `${parseFloat(baseBalance?.free ?? '0').toFixed(6)} ${baseAsset}`}
          </span>
        </div>

        {/* 快捷操作按钮 */}
        <div className={styles.quickActions}>
          <button
            type="button"
            className={`${styles.quickBtn} ${side === 'buy' ? styles.allInBuyBtn : styles.allInSellBtn}`}
            onClick={() => setShowAllInConfirm(true)}
            disabled={!metrics}
          >
            {side === 'buy' 
              ? (t.orderEntry?.allInBuy || '满仓买入')
              : (t.orderEntry?.allInSell || '全部卖出')}
          </button>
        </div>

        {/* 数据状态提示 - 用视觉设计代替文字说明 */}
        {dataConfidence.level !== 'live' && (
          <div className={`${styles.confidenceWarning} ${styles[dataConfidence.level]}`}>
            <div className={styles.warningBar} />
            <span className={styles.warningText}>{dataConfidence.reason}</span>
          </div>
        )}

        {/* DEGRADED 二次确认 */}
        {showDegradedConfirm && (
          <div className={styles.degradedConfirm}>
            <p className={styles.confirmText}>{t.orderEntry.confirmDegraded}</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => {
                  setShowDegradedConfirm(false);
                  handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
              >
                {t.common.confirm}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowDegradedConfirm(false)}
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className={`btn ${styles.submitBtn} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit} ${dataConfidence.level !== 'live' ? styles[dataConfidence.level] : ''}`}
          disabled={isSubmitDisabled}
        >
          {side === 'buy' 
            ? formatMessage(t.orderEntry.placeBuyOrder, { symbol: baseAsset })
            : formatMessage(t.orderEntry.placeSellOrder, { symbol: baseAsset })}
        </button>
      </form>

      {/* 满仓确认弹窗 */}
      <ConfirmModal
        isOpen={showAllInConfirm}
        title={side === 'buy' 
          ? (t.orderEntry?.confirmAllInBuyTitle || '确认满仓买入')
          : (t.orderEntry?.confirmAllInSellTitle || '确认全部卖出')}
        message={side === 'buy'
          ? (t.orderEntry?.confirmAllInBuyMessage || `将使用全部可用 ${quoteAsset} 买入 ${baseAsset}`)
          : (t.orderEntry?.confirmAllInSellMessage || `将卖出全部持有的 ${baseAsset}`)}
        detail={side === 'buy'
          ? `${parseFloat(quoteBalance?.free ?? '0').toFixed(2)} ${quoteAsset} → ${baseAsset}`
          : `${parseFloat(baseBalance?.free ?? '0').toFixed(6)} ${baseAsset} → ${quoteAsset}`}
        confirmText={side === 'buy' 
          ? (t.orderEntry?.confirmAllInBuy || '确认买入')
          : (t.orderEntry?.confirmAllInSell || '确认卖出')}
        cancelText={t.common?.cancel || '取消'}
        onConfirm={() => {
          setShowAllInConfirm(false);
          updateQuantityFromPercent(100);
          if (type === 'limit' && !price && metrics) {
            setPrice(side === 'buy' ? bestAsk?.price || metrics.mid : bestBid?.price || metrics.mid);
          }
        }}
        onCancel={() => setShowAllInConfirm(false)}
        type={side}
      />
    </div>
  );
}
