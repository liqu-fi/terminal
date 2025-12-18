import { useRef, useEffect, useMemo } from 'react';
import { useMarketStore, selectOrderBook, selectMetrics, selectDataConfidence } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import type { OrderBookLevel } from '../../types/market';
import styles from './OrderBook.module.css';

interface PriceLevelProps {
  level: OrderBookLevel;
  side: 'bid' | 'ask';
  maxQuantity: number;
  prevPrice?: string;
  onPriceClick?: (price: string, side: 'buy' | 'sell') => void;
}

function PriceLevel({ level, side, maxQuantity, prevPrice, onPriceClick }: PriceLevelProps) {
  const depthPercent = Math.min((parseFloat(level.quantity) / maxQuantity) * 100, 100);
  const priceChanged = prevPrice && prevPrice !== level.price;
  const priceUp = priceChanged && parseFloat(level.price) > parseFloat(prevPrice);
  
  const handleClick = () => {
    if (onPriceClick) {
      const orderSide = side === 'bid' ? 'buy' : 'sell';
      onPriceClick(level.price, orderSide);
    }
  };
  
  return (
    <div 
      className={`${styles.level} ${priceChanged ? (priceUp ? 'flash-up' : 'flash-down') : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div 
        className={`${styles.depthBar} ${styles[side]}`} 
        style={{ width: `${depthPercent}%` }}
      />
      <span className={`${styles.price} ${side === 'bid' ? 'price-up' : 'price-down'} tabular-nums`}>
        {formatPrice(level.price)}
      </span>
      <span className={`${styles.quantity} tabular-nums`}>
        {formatQuantity(level.quantity)}
      </span>
    </div>
  );
}

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(8);
}

function formatQuantity(qty: string): string {
  const num = parseFloat(qty);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

interface OrderBookProps {
  onPriceClick?: (price: string, side: 'buy' | 'sell') => void;
}

export function OrderBook({ onPriceClick }: OrderBookProps) {
  const { t } = useI18n();
  const orderBook = useMarketStore(selectOrderBook);
  const metrics = useMarketStore(selectMetrics);
  const dataConfidence = useMarketStore(selectDataConfidence);
  const prevOrderBookRef = useRef<typeof orderBook>(null);
  
  const { level, reason } = dataConfidence;
  const isResyncing = level === 'resyncing';
  const isStale = level === 'stale';

  useEffect(() => {
    prevOrderBookRef.current = orderBook;
  }, [orderBook]);

  const { maxBidQty, maxAskQty } = useMemo(() => {
    if (!orderBook) return { maxBidQty: 1, maxAskQty: 1 };
    
    const maxBid = Math.max(...orderBook.bids.map(l => parseFloat(l.quantity)), 0.001);
    const maxAsk = Math.max(...orderBook.asks.map(l => parseFloat(l.quantity)), 0.001);
    const maxQty = Math.max(maxBid, maxAsk);
    
    return { maxBidQty: maxQty, maxAskQty: maxQty };
  }, [orderBook]);

  const prevPriceMap = useMemo(() => {
    const map = new Map<string, string>();
    const prev = prevOrderBookRef.current;
    if (prev) {
      prev.bids.forEach((l, i) => map.set(`bid-${i}`, l.price));
      prev.asks.forEach((l, i) => map.set(`ask-${i}`, l.price));
    }
    return map;
  }, [orderBook]);

  if (!orderBook) {
    return (
      <div className={`card ${styles.container}`}>
        <div className="card-header">{t.orderBook.title}</div>
        <div className={`card-body ${styles.loading}`}>
          <span>{t.common.loading}</span>
        </div>
      </div>
    );
  }

  const spread = metrics?.spread ? parseFloat(metrics.spread) : 0;
  const spreadBps = metrics?.spreadBps ?? 0;

  // 获取可信度状态的颜色类
  const getConfidenceClass = () => {
    if (isStale) return styles.stale;
    if (isResyncing) return styles.resyncing;
    if (level === 'degraded') return styles.degraded;
    return '';
  };

  return (
    <div className={`card ${styles.container} ${getConfidenceClass()}`}>
      <div className="card-header">
        <span>{t.orderBook.title}</span>
        {/* 状态指示 - 纯视觉，无文字，SVG 图标 */}
        {level !== 'live' && (
          <span className={`${styles.confidenceBadge} ${styles[level]}`} title={reason}>
            {isResyncing && <Icon name="refresh-cw" size="sm" />}
            {isStale && <Icon name="pause" size="sm" />}
            {level === 'degraded' && <Icon name="alert-triangle" size="sm" />}
          </span>
        )}
      </div>
      
      {/* 重建中的覆盖层 - 简洁的视觉反馈 */}
      {isResyncing && (
        <div className={styles.resyncOverlay}>
          <div className={styles.resyncSpinner} />
        </div>
      )}
      
      <div className={`${styles.body} ${isStale ? styles.staleBody : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <span>{t.orderBook.price}</span>
          <span>{t.orderBook.amount}</span>
        </div>

        {/* Asks (reversed to show lowest at bottom) */}
        <div className={styles.asksSection}>
          {[...orderBook.asks].reverse().slice(0, 12).map((lvl, i) => (
            <PriceLevel
              key={`ask-${lvl.price}`}
              level={lvl}
              side="ask"
              maxQuantity={maxAskQty}
              prevPrice={prevPriceMap.get(`ask-${11 - i}`)}
              onPriceClick={onPriceClick ? (price) => onPriceClick(price, 'sell') : undefined}
            />
          ))}
        </div>

        {/* Spread */}
        <div className={styles.spreadSection}>
          <span className={styles.spreadLabel}>{t.orderBook.spread}</span>
          <span className={`${styles.spreadValue} tabular-nums`}>
            {formatPrice(String(spread))}
          </span>
          <span className={`${styles.spreadBps} tabular-nums`}>
            ({spreadBps.toFixed(2)} {t.orderBook.spreadBps})
          </span>
        </div>

        {/* Bids */}
        <div className={styles.bidsSection}>
          {orderBook.bids.slice(0, 12).map((lvl, i) => (
            <PriceLevel
              key={`bid-${lvl.price}`}
              level={lvl}
              side="bid"
              maxQuantity={maxBidQty}
              prevPrice={prevPriceMap.get(`bid-${i}`)}
              onPriceClick={onPriceClick ? (price) => onPriceClick(price, 'buy') : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
