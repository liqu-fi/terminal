import { useMemo } from 'react';
import { useMarketStore, selectOrderBook, selectMetrics, selectRecentTrades } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import styles from './DepthChart.module.css';

const DEPTH_LEVELS = 15;

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function formatQuantity(qty: number): string {
  if (qty >= 1000) return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(4);
  return qty.toFixed(5);
}

export function DepthChart() {
  const { t } = useI18n();
  const orderBook = useMarketStore(selectOrderBook);
  const metrics = useMarketStore(selectMetrics);
  const recentTrades = useMarketStore(selectRecentTrades);

  const chartData = useMemo(() => {
    if (!orderBook || !metrics) return null;

    const midPrice = parseFloat(metrics.mid);
    if (midPrice === 0) return null;

    // Get top levels
    const bids = orderBook.bids.slice(0, DEPTH_LEVELS);
    const asks = orderBook.asks.slice(0, DEPTH_LEVELS);

    // Calculate cumulative quantities
    let bidCumulative = 0;
    let askCumulative = 0;
    
    const bidLevels = bids.map((level) => {
      const price = parseFloat(level.price);
      const qty = parseFloat(level.quantity);
      bidCumulative += qty;
      const pricePercent = ((midPrice - price) / midPrice) * 100;
      return {
        price,
        quantity: qty,
        cumulative: bidCumulative,
        pricePercent,
      };
    });

    const askLevels = asks.map((level) => {
      const price = parseFloat(level.price);
      const qty = parseFloat(level.quantity);
      askCumulative += qty;
      const pricePercent = ((price - midPrice) / midPrice) * 100;
      return {
        price,
        quantity: qty,
        cumulative: askCumulative,
        pricePercent,
      };
    });

    // Find max cumulative for scaling
    const maxCumulative = Math.max(
      bidLevels[bidLevels.length - 1]?.cumulative ?? 0,
      askLevels[askLevels.length - 1]?.cumulative ?? 0
    );

    // Recent trades at price levels
    const recentTradesPrices = recentTrades.slice(0, 20).map(t => ({
      price: parseFloat(t.price),
      isBuy: !t.isBuyerMaker,
    }));

    return {
      midPrice,
      bidLevels,
      askLevels,
      maxCumulative,
      recentTradesPrices,
    };
  }, [orderBook, metrics, recentTrades]);

  if (!chartData) {
    return (
      <div className={`card ${styles.container}`}>
        <div className="card-header">{t.depthChart.title}</div>
        <div className={`card-body ${styles.loading}`}>
          {t.common.loading}
        </div>
      </div>
    );
  }

  const { midPrice, bidLevels, askLevels, maxCumulative, recentTradesPrices } = chartData;

  // Scale function: use log scale to prevent large orders from dominating
  const scaleWidth = (cumulative: number) => {
    if (maxCumulative === 0) return 0;
    // Use log scale
    const logMax = Math.log10(maxCumulative + 1);
    const logCum = Math.log10(cumulative + 1);
    return (logCum / logMax) * 100;
  };

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">
        <span>{t.depthChart.title}</span>
        <span className={`${styles.midPrice} tabular-nums`}>
          {t.orderBook.midPrice}: {formatPrice(midPrice)}
        </span>
      </div>
      
      <div className={styles.chart}>
        {/* Bid side (left) */}
        <div className={styles.bidSide}>
          {bidLevels.map((level, i) => (
            <div key={`bid-${i}`} className={styles.level}>
              <div 
                className={`${styles.bar} ${styles.bidBar}`}
                style={{ width: `${scaleWidth(level.cumulative)}%` }}
              >
                <span className={`${styles.barLabel} tabular-nums`}>
                  {formatQuantity(level.quantity)}
                </span>
              </div>
              <span className={`${styles.price} tabular-nums price-up`}>
                {formatPrice(level.price)}
              </span>
            </div>
          ))}
        </div>

        {/* Center - Recent trades indicator */}
        <div className={styles.center}>
          <div className={styles.midLine} />
          <div className={styles.tradeIndicators}>
            {recentTradesPrices.slice(0, 5).map((trade, i) => {
              const relativePos = ((trade.price - midPrice) / midPrice) * 1000;
              const clampedPos = Math.max(-50, Math.min(50, relativePos));
              return (
                <div
                  key={i}
                  className={`${styles.tradeIndicator} ${trade.isBuy ? styles.buyTrade : styles.sellTrade}`}
                  style={{ 
                    top: `${50 + clampedPos}%`,
                    opacity: 1 - (i * 0.15),
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Ask side (right) */}
        <div className={styles.askSide}>
          {askLevels.map((level, i) => (
            <div key={`ask-${i}`} className={styles.level}>
              <span className={`${styles.price} tabular-nums price-down`}>
                {formatPrice(level.price)}
              </span>
              <div 
                className={`${styles.bar} ${styles.askBar}`}
                style={{ width: `${scaleWidth(level.cumulative)}%` }}
              >
                <span className={`${styles.barLabel} tabular-nums`}>
                  {formatQuantity(level.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.bidDot}`} />
          <span>{t.depthChart.bids}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.askDot}`} />
          <span>{t.depthChart.asks}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.tradeDot}`} />
          <span>{t.recentTrades.title}</span>
        </div>
      </div>
    </div>
  );
}
