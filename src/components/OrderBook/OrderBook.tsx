import { useRef, useEffect, useMemo, memo } from 'react';
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

const PriceLevel = memo(({ level, side, maxQuantity, prevPrice, onPriceClick }: PriceLevelProps) => {
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
});

PriceLevel.displayName = 'PriceLevel';

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num >= 1000) return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function formatQuantity(qty: string): string {
  const num = parseFloat(qty);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(5);
}

interface OrderBookProps {
  onPriceClick?: (price: string, side: 'buy' | 'sell') => void;
  embedded?: boolean;  // 嵌入到BottomTabs时使用的模式
  compact?: boolean;   // 移动端紧凑模式
}

export function OrderBook({ onPriceClick, embedded = false, compact = false }: OrderBookProps) {
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
    
    // Efficiently find max quantity from all visible levels
    let max = 0.001;
    orderBook.bids.forEach(lvl => max = Math.max(max, parseFloat(lvl.quantity)));
    orderBook.asks.forEach(lvl => max = Math.max(max, parseFloat(lvl.quantity)));
    
    return { maxBidQty: max, maxAskQty: max };
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
        <div className="card-header"><span className="card-title">{t.orderBook.title}</span></div>
        <div className={`card-body ${styles.loading}`}>
          <Icon name="loader" className={styles.spinner} />
        </div>
      </div>
    );
  }

  const spread = metrics?.spread ? parseFloat(metrics.spread) : 0;
  const spreadBps = metrics?.spreadBps ?? 0;

  // 嵌入模式使用横向布局
  if (embedded) {
    return (
      <div className={`${styles.embeddedContainer} ${styles[level] || ''}`}>
        <div className={`${styles.embeddedBody} ${isStale ? styles.staleBody : ''}`}>
          {/* Bids Section - Left */}
          <div className={styles.embeddedBids}>
            <div className={styles.embeddedHeader}>
              <span className="price-up">{t.orderBook?.buyOrders || 'Bids'}</span>
              <span>{t.orderBook.price}</span>
              <span>{t.orderBook.amount}</span>
            </div>
            <div className={styles.embeddedScrollContent}>
              {orderBook.bids.slice(0, 15).map((lvl, i) => (
                <PriceLevel
                  key={`bid-${lvl.price}`}
                  level={lvl}
                  side="bid"
                  maxQuantity={maxBidQty}
                  prevPrice={prevPriceMap.get(`bid-${i}`)}
                  onPriceClick={onPriceClick}
                />
              ))}
            </div>
          </div>

          {/* Spread in center */}
          <div className={styles.embeddedSpread}>
            <div className={styles.spreadValue}>
              <span className="tabular-nums">{formatPrice(String(spread))}</span>
              <span className={styles.spreadBps}>({spreadBps.toFixed(2)} bps)</span>
            </div>
            {level !== 'live' && (
              <div className={styles.confidenceIcon} title={reason}>
                {isResyncing && <Icon name="refresh-cw" size="sm" className={styles.spinning} />}
                {isStale && <Icon name="wifi-off" size="sm" />}
                {level === 'degraded' && <Icon name="alert-triangle" size="sm" />}
              </div>
            )}
          </div>

          {/* Asks Section - Right */}
          <div className={styles.embeddedAsks}>
            <div className={styles.embeddedHeader}>
              <span className="price-down">{t.orderBook?.sellOrders || 'Asks'}</span>
              <span>{t.orderBook.price}</span>
              <span>{t.orderBook.amount}</span>
            </div>
            <div className={styles.embeddedScrollContent}>
              {orderBook.asks.slice(0, 15).map((lvl, i) => (
                <PriceLevel
                  key={`ask-${lvl.price}`}
                  level={lvl}
                  side="ask"
                  maxQuantity={maxAskQty}
                  prevPrice={prevPriceMap.get(`ask-${i}`)}
                  onPriceClick={onPriceClick}
                />
              ))}
            </div>
          </div>
        </div>

        {isResyncing && (
          <div className={styles.resyncOverlay}>
            <Icon name="refresh-cw" className={styles.resyncSpinner} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`card ${styles.container} ${compact ? styles.compact : ''} ${styles[level] || ''}`}>
      {!compact && (
        <div className="card-header">
          <span className="card-title">{t.orderBook.title}</span>
          {level !== 'live' && (
            <div className={styles.confidenceIcon} title={reason}>
              {isResyncing && <Icon name="refresh-cw" size="sm" className={styles.spinning} />}
              {isStale && <Icon name="wifi-off" size="sm" />}
              {level === 'degraded' && <Icon name="alert-triangle" size="sm" />}
            </div>
          )}
        </div>
      )}
      
      <div className={`${styles.body} ${isStale ? styles.staleBody : ''}`}>
        <div className={styles.header}>
          <span>{t.orderBook.price}</span>
          <span>{t.orderBook.amount}</span>
        </div>

        <div className={styles.asksSection}>
          <div className={styles.scrollContent}>
            {orderBook.asks.slice(compact ? -10 : undefined).reverse().map((lvl, i) => (
              <PriceLevel
                key={`ask-${lvl.price}`}
                level={lvl}
                side="ask"
                maxQuantity={maxAskQty}
                prevPrice={prevPriceMap.get(`ask-${orderBook.asks.length - 1 - i}`)}
                onPriceClick={onPriceClick}
              />
            ))}
          </div>
        </div>

        <div className={styles.spreadSection}>
          <div className={styles.spreadValue}>
            <span className="tabular-nums">{formatPrice(String(spread))}</span>
            <span className={styles.spreadBps}>({spreadBps.toFixed(2)} bps)</span>
          </div>
          {compact && level !== 'live' && (
            <div className={styles.confidenceIcon} title={reason}>
              {isResyncing && <Icon name="refresh-cw" size="xs" className={styles.spinning} />}
              {isStale && <Icon name="wifi-off" size="xs" />}
              {level === 'degraded' && <Icon name="alert-triangle" size="xs" />}
            </div>
          )}
        </div>

        <div className={styles.bidsSection}>
          <div className={styles.scrollContent}>
            {orderBook.bids.slice(0, compact ? 10 : undefined).map((lvl, i) => (
              <PriceLevel
                key={`bid-${lvl.price}`}
                level={lvl}
                side="bid"
                maxQuantity={maxBidQty}
                prevPrice={prevPriceMap.get(`bid-${i}`)}
                onPriceClick={onPriceClick}
              />
            ))}
          </div>
        </div>
      </div>

      {isResyncing && (
        <div className={styles.resyncOverlay}>
          <Icon name="refresh-cw" className={styles.resyncSpinner} />
        </div>
      )}
    </div>
  );
}
