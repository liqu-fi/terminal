
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
      case 'pending': return 'Pending';
      case 'submitted': return 'Submitted';
      case 'open': return 'Open';
      case 'partial': return 'Partial';
      case 'filled': return 'Filled';
      case 'cancelled': return 'Cancelled';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  return (
    <tr className={`${styles[order.status] || ''}`}>
      <td>
        <div className={styles.sideCell}>
          <span className={`${styles.sideBadge} ${isBuy ? styles.buy : styles.sell}`}>
            {isBuy ? 'B' : 'S'}
          </span>
          <span className={styles.typeBadge}>
            {order.type === 'limit' ? 'LMT' : 'MKT'}
          </span>
        </div>
      </td>
      <td>
        <span className={styles.symbol}>{order.symbol.replace('USDT', '')}</span>
      </td>
      <td className={styles.numericCell}>
        {order.price ? parseFloat(order.price).toFixed(2) : '—'}
      </td>
      <td className={styles.numericCell}>
        {parseFloat(order.quantity).toFixed(6)}
      </td>
      <td className={styles.statusCell}>
        <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
          {getStatusText(order.status)}
        </span>
        {order.status === 'partial' && (
          <div className={styles.filledBar}>
            <div 
              className={`${styles.filledBarInner} ${isBuy ? styles.buy : styles.sell}`}
              style={{ width: `${filledPercent}%` }}
            />
          </div>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        {canCancel && (
          <button className={styles.cancelBtn} onClick={handleCancel}>
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
}

export function OpenOrders() {
  const { t } = useI18n();
  const orders = useTradingStore((state) => state.getOpenOrders());

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {t.openOrders.title}
          <span className={styles.orderCount}>({orders.length})</span>
        </span>
      </div>
      
      <div className={styles.body}>
        {orders.length === 0 ? (
          <div className={styles.empty}>{t.openOrders.noOrders}</div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Side</th>
                <th>Symbol</th>
                <th>Price</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {orders.map((order) => (
                <OrderRow key={order.clientOrderId} order={order} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
