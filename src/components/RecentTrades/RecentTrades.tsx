import { useMarketStore, selectRecentTrades } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import type { Trade } from '../../types/market';
import styles from './RecentTrades.module.css';

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = !trade.isBuyerMaker;
  const priceClass = isBuy ? 'price-up' : 'price-down';
  const arrow = isBuy ? '▲' : '▼';

  return (
    <div className={styles.row}>
      <span className={`${styles.price} ${priceClass} tabular-nums`}>
        <span className={styles.arrow}>{arrow}</span>
        {formatPrice(trade.price)}
      </span>
      <span className={`${styles.quantity} tabular-nums`}>
        {formatQuantity(trade.quantity)}
      </span>
      <span className={`${styles.time} tabular-nums`}>
        {formatTime(trade.time)}
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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RecentTrades() {
  const { t } = useI18n();
  const trades = useMarketStore(selectRecentTrades);

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">{t.recentTrades.title}</div>
      
      <div className={styles.header}>
        <span>{t.orderBook.price}</span>
        <span>{t.orderBook.amount}</span>
        <span>{t.recentTrades.time}</span>
      </div>

      <div className={styles.body}>
        {trades.length === 0 ? (
          <div className={styles.empty}>{t.recentTrades.noTrades}</div>
        ) : (
          trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))
        )}
      </div>
    </div>
  );
}
