import { useTradingStore } from '../../store/tradingStore';
import { useI18n } from '../../i18n';
import { toast } from '../Toast';
import type { PaperOrder } from '../../types/trading';
import styles from './OpenOrders.module.css';

function OrderRow({ order }: { order: PaperOrder }) {
  const { t } = useI18n();
  const cancelOrder = useTradingStore((state) => state.cancelOrder);
  
  const canCancel = ['pending', 'open', 'partial'].includes(order.status);
  const isBuy = order.side === 'buy';
  const filledPercent = parseFloat(order.quantity) > 0 
    ? (parseFloat(order.filledQty) / parseFloat(order.quantity)) * 100 
    : 0;

  const handleCancel = () => {
    cancelOrder(order.clientOrderId);
    toast.info(t.toast.orderCancelled);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t.orderStatus.pending;
      case 'submitted': return t.orderStatus.submitted;
      case 'open': return t.orderStatus.open;
      case 'partial': return t.orderStatus.partial;
      case 'filled': return t.orderStatus.filled;
      case 'cancelled': return t.orderStatus.cancelled;
      case 'rejected': return t.orderStatus.rejected;
      default: return status;
    }
  };

  return (
    <div className={`${styles.row} ${styles[order.status]}`}>
      <div className={styles.mainInfo}>
        <div className={styles.sideType}>
          <span className={`${styles.side} ${isBuy ? styles.buy : styles.sell}`}>
            {isBuy ? t.orderEntry.buy : t.orderEntry.sell}
          </span>
          <span className={styles.type}>
            {order.type === 'limit' ? t.orderEntry.limit : t.orderEntry.market}
          </span>
        </div>
        <div className={styles.symbol}>{order.symbol}</div>
      </div>

      <div className={styles.details}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orderEntry.price}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {order.price ? parseFloat(order.price).toFixed(2) : t.orderEntry.market}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orderEntry.amount}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {parseFloat(order.quantity).toFixed(6)}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.openOrders.filled}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {filledPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {order.status === 'partial' && (
        <div className={styles.progressBar}>
          <div 
            className={`${styles.progressFill} ${isBuy ? styles.buyFill : styles.sellFill}`}
            style={{ width: `${filledPercent}%` }}
          />
        </div>
      )}

      <div className={styles.statusRow}>
        <span className={`${styles.status} ${styles[`status_${order.status}`]}`}>
          {getStatusText(order.status)}
        </span>
        
        {canCancel && (
          <button className={styles.cancelBtn} onClick={handleCancel}>
            {t.openOrders.cancel}
          </button>
        )}
      </div>
    </div>
  );
}

export function OpenOrders() {
  const { t } = useI18n();
  const orders = useTradingStore((state) => state.getOpenOrders());

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">{t.openOrders.title} ({orders.length})</div>
      
      <div className={styles.body}>
        {orders.length === 0 ? (
          <div className={styles.empty}>{t.openOrders.noOrders}</div>
        ) : (
          orders.map((order) => (
            <OrderRow key={order.clientOrderId} order={order} />
          ))
        )}
      </div>
    </div>
  );
}
