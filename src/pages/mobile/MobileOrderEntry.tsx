import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useMarketStore, selectOrderBook, selectMetrics, selectBestBid, selectBestAsk, selectDataConfidence } from '../../store/marketStore';
import { useTradingStore } from '../../store/tradingStore';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useI18n, formatMessage } from '../../i18n';
import { toast } from '../../components/Toast';
import { Icon } from '../../components/Icon';
import type { OrderSide, OrderType } from '../../types/trading';
import styles from './MobileOrderEntry.module.css';

interface MobileOrderEntryProps {
  side: OrderSide;
  onSideChange: (side: OrderSide) => void;
  priceFromOrderBook?: string;
  onSuccess?: () => void;
}

export function MobileOrderEntry({
  side,
  onSideChange,
  priceFromOrderBook,
  onSuccess,
}: MobileOrderEntryProps) {
  const { t } = useI18n();
  const [type, setType] = useState<OrderType>('limit');
  const [price, setPrice] = useState(priceFromOrderBook || '');
  const [quantity, setQuantity] = useState('');
  const [quantityPercent, setQuantityPercent] = useState(0);

  const orderBook = useMarketStore(selectOrderBook);
  const metrics = useMarketStore(selectMetrics);
  const bestBid = useMarketStore(selectBestBid);
  const bestAsk = useMarketStore(selectBestAsk);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const balances = useWalletStore(selectBalances);
  const createOrder = useTradingStore((state) => state.createOrder);

  const symbol = orderBook?.symbol ?? 'BTCUSDT';
  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = 'USDT';
  const baseBalance = balances.find(b => b.asset === baseAsset);
  const quoteBalance = balances.find(b => b.asset === quoteAsset);

  // Sync price from orderbook
  useEffect(() => {
    if (priceFromOrderBook) setPrice(priceFromOrderBook);
  }, [priceFromOrderBook]);

  // Auto-fill price when switching to limit
  useEffect(() => {
    if (type === 'limit' && !price && metrics) {
      setPrice(side === 'buy' ? (bestAsk?.price || metrics.mid) : (bestBid?.price || metrics.mid));
    }
  }, [type, price, metrics, side, bestAsk, bestBid]);

  const total = useMemo(() => {
    if (type === 'limit' && price && quantity) {
      const p = parseFloat(price);
      const q = parseFloat(quantity);
      return !isNaN(p) && !isNaN(q) ? (p * q).toFixed(2) : '0';
    } else if (type === 'market' && quantity && metrics) {
      const q = parseFloat(quantity);
      const mid = parseFloat(metrics.mid);
      return !isNaN(q) && !isNaN(mid) ? (mid * q).toFixed(2) : '0';
    }
    return '0';
  }, [price, quantity, type, metrics]);

  const getMaxQuantity = useCallback(() => {
    if (side === 'buy' && quoteBalance && metrics) {
      const av = parseFloat(quoteBalance.available);
      const p = type === 'limit' && price ? parseFloat(price) : parseFloat(metrics.mid);
      return p > 0 ? av / p : 0;
    } else if (side === 'sell' && baseBalance) {
      return parseFloat(baseBalance.available);
    }
    return 0;
  }, [side, type, price, quoteBalance, baseBalance, metrics]);

  const updateQuantityFromPercent = useCallback((pct: number) => {
    const max = getMaxQuantity();
    if (max > 0) {
      setQuantity((max * pct / 100).toFixed(6));
      setQuantityPercent(pct);
    }
  }, [getMaxQuantity]);

  const handleSubmit = () => {
    if (dataConfidence.level === 'stale') {
      toast.warning(t.dataConfidence?.staleDesc || 'Data is stale');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.warning(t.orderEntry?.invalidAmount || 'Invalid amount');
      return;
    }
    if (type === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast.warning(t.orderEntry?.invalidPrice || 'Invalid price');
      return;
    }

    const order = createOrder({
      symbol,
      side,
      type,
      price: type === 'limit' ? price : undefined,
      quantity,
    }, metrics?.mid);

    if (order) {
      toast.success(t.toast?.orderSubmitted || 'Order submitted');
      setQuantity('');
      setQuantityPercent(0);
      onSuccess?.();
    } else {
      toast.error(t.orderEntry?.insufficientBalance || 'Insufficient balance');
    }
  };

  const availableBalance = side === 'buy'
    ? `${parseFloat(quoteBalance?.available ?? '0').toFixed(2)} ${quoteAsset}`
    : `${parseFloat(baseBalance?.available ?? '0').toFixed(6)} ${baseAsset}`;

  return (
    <div className={styles.container}>
      {/* Side Toggle */}
      <div className={styles.sideToggle}>
        <button
          className={`${styles.sideBtn} ${styles.buyBtn} ${side === 'buy' ? styles.active : ''}`}
          onClick={() => onSideChange('buy')}
        >
          {t.orderEntry?.buy || 'Buy'}
        </button>
        <button
          className={`${styles.sideBtn} ${styles.sellBtn} ${side === 'sell' ? styles.active : ''}`}
          onClick={() => onSideChange('sell')}
        >
          {t.orderEntry?.sell || 'Sell'}
        </button>
      </div>

      {/* Type Toggle */}
      <div className={styles.typeToggle}>
        <button
          className={`${styles.typeBtn} ${type === 'limit' ? styles.active : ''}`}
          onClick={() => setType('limit')}
        >
          {t.orderEntry?.limit || 'Limit'}
        </button>
        <button
          className={`${styles.typeBtn} ${type === 'market' ? styles.active : ''}`}
          onClick={() => setType('market')}
        >
          {t.orderEntry?.market || 'Market'}
        </button>
      </div>

      {/* Price Input */}
      {type === 'limit' && (
        <div className={styles.inputGroup}>
          <label className={styles.label}>{t.orderEntry?.price || 'Price'}</label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              inputMode="decimal"
              className={styles.input}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
            <span className={styles.inputSuffix}>{quoteAsset}</span>
          </div>
          <div className={styles.quickPriceRow}>
            <button
              className={styles.quickPriceBtn}
              onClick={() => bestBid && setPrice(bestBid.price)}
            >
              Bid
            </button>
            <button
              className={styles.quickPriceBtn}
              onClick={() => metrics && setPrice(metrics.mid)}
            >
              Mid
            </button>
            <button
              className={styles.quickPriceBtn}
              onClick={() => bestAsk && setPrice(bestAsk.price)}
            >
              Ask
            </button>
          </div>
        </div>
      )}

      {/* Quantity Input */}
      <div className={styles.inputGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label}>{t.orderEntry?.amount || 'Amount'}</label>
          <span className={styles.availableHint}>
            {t.orderEntry?.available || 'Available'}: {availableBalance}
          </span>
        </div>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
          />
          <span className={styles.inputSuffix}>{baseAsset}</span>
        </div>

        {/* Percentage Buttons */}
        <div className={styles.percentRow}>
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              className={`${styles.percentBtn} ${quantityPercent === pct ? styles.active : ''}`}
              onClick={() => updateQuantityFromPercent(pct)}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>{t.orderEntry?.total || 'Total'}</span>
        <span className={`${styles.totalValue} tabular-nums`}>
          ≈ {total} {quoteAsset}
        </span>
      </div>

      {/* Data Confidence Warning */}
      {dataConfidence.level !== 'live' && (
        <div className={`${styles.warning} ${styles[dataConfidence.level]}`}>
          <Icon name="alert-triangle" size="sm" />
          <span>{dataConfidence.reason}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        className={`${styles.submitBtn} ${side === 'buy' ? styles.buySubmit : styles.sellSubmit}`}
        onClick={handleSubmit}
        disabled={dataConfidence.level === 'stale' || !quantity}
      >
        {side === 'buy'
          ? formatMessage(t.orderEntry?.placeBuyOrder || 'Buy {symbol}', { symbol: baseAsset })
          : formatMessage(t.orderEntry?.placeSellOrder || 'Sell {symbol}', { symbol: baseAsset })
        }
      </button>
    </div>
  );
}

