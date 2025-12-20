
import { memo } from 'react';
import { useMarketStore, selectRecentTrades } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import type { Trade } from '../../types/market';
import styles from './RecentTrades.module.css';

const TradeRow = memo(({ trade, onClick }: { trade: Trade; onClick?: (price: string) => void }) => {
  const isBuy = !trade.isBuyerMaker;
  const priceClass = isBuy ? 'price-up' : 'price-down';

  return (
    <div className={styles.row} onClick={() => onClick?.(trade.price)} role="button" tabIndex={0}>
      <span className={`${styles.price} ${priceClass} tabular-nums`}>
        <Icon 
          name={isBuy ? 'trending-up' : 'trending-down'} 
          size="xs" 
          className={styles.tradeIcon} 
        />
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
});

TradeRow.displayName = 'TradeRow';

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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface RecentTradesProps {
  onPriceClick?: (price: string) => void;
  compact?: boolean;
}

export function RecentTrades({ onPriceClick, compact = false }: RecentTradesProps) {
  const { t } = useI18n();
  const trades = useMarketStore(selectRecentTrades);

  return (
    <div className={`card ${styles.container} ${compact ? styles.compact : ''} animate-fade`}>
      {!compact && (
        <div className="card-header">
          <span className="card-title">{t.recentTrades?.title || 'Recent Trades'}</span>
        </div>
      )}
      
      <div className={styles.header}>
        <span>{t.orderBook?.price || 'Price'}</span>
        <span>{t.orderBook?.amount || 'Amount'}</span>
        <span>{t.recentTrades?.time || 'Time'}</span>
      </div>

      <div className={styles.body}>
        {!trades || trades.length === 0 ? (
          <div className={styles.empty}>
            <Icon name="history" size="lg" className={styles.emptyIcon} />
            <span>{t.recentTrades?.noTrades || 'No trades'}</span>
          </div>
        ) : (
          <div className={styles.list}>
            {trades.slice(0, compact ? 20 : 50).map((trade) => (
              <TradeRow key={trade.id} trade={trade} onClick={onPriceClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
