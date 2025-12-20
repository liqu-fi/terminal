import { useState, useMemo } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MobileHeader } from '../../components/Layout';
import { MobileSegmentedControl, MobileDrawer } from '../../components/mobile';
import type { PaperOrder, OrderStatus } from '../../types/trading';
import styles from './OrdersPage.mobile.module.css';

type TabType = 'open' | 'history' | 'trades';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price: string | null): string {
  if (!price) return 'Market';
  const num = parseFloat(price);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function formatQuantity(qty: string): string {
  const num = parseFloat(qty);
  if (num >= 100) return num.toFixed(2);
  return num.toFixed(4);
}

function getStatusConfig(status: OrderStatus) {
  const configs: Record<OrderStatus, { text: string; className: string }> = {
    pending: { text: 'Pending', className: styles.statusPending || '' },
    submitted: { text: 'Submitted', className: styles.statusSubmitted || '' },
    open: { text: 'Open', className: styles.statusOpen || '' },
    partial: { text: 'Partial', className: styles.statusPartial || '' },
    filled: { text: 'Filled', className: styles.statusFilled || '' },
    cancelled: { text: 'Cancelled', className: styles.statusCancelled || '' },
    rejected: { text: 'Rejected', className: styles.statusRejected || '' },
  };
  return configs[status] || { text: status, className: '' };
}

function OrderCard({ order, onCancel, onSelect }: {
  order: PaperOrder;
  onCancel?: (id: string) => void;
  onSelect?: (order: PaperOrder) => void;
}) {
  const status = getStatusConfig(order.status);
  const isBuy = order.side === 'buy';
  const canCancel = ['pending', 'open', 'partial'].includes(order.status);
  const fillPercent = parseFloat(order.quantity) > 0
    ? (parseFloat(order.filledQty) / parseFloat(order.quantity)) * 100
    : 0;

  return (
    <div className={styles.orderCard} onClick={() => onSelect?.(order)}>
      <div className={styles.cardHeader}>
        <div className={styles.symbolRow}>
          <span className={styles.symbolName}>{order.symbol.replace('USDT', '')}</span>
          <span className={styles.symbolQuote}>/USDT</span>
          <span className={`${styles.sideBadge} ${isBuy ? styles.buy : styles.sell}`}>
            {isBuy ? 'BUY' : 'SELL'}
          </span>
        </div>
        <span className={`${styles.statusBadge} ${status.className}`}>
          {status.text}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.priceRow}>
          <div className={styles.priceItem}>
            <span className={styles.priceLabel}>Price</span>
            <span className={`${styles.priceValue} tabular-nums`}>
              {formatPrice(order.price)}
            </span>
          </div>
          <div className={styles.priceItem}>
            <span className={styles.priceLabel}>Amount</span>
            <span className={`${styles.priceValue} tabular-nums`}>
              {formatQuantity(order.filledQty)}/{formatQuantity(order.quantity)}
            </span>
          </div>
          {order.avgPrice && parseFloat(order.avgPrice) > 0 && (
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Avg Price</span>
              <span className={`${styles.priceValue} tabular-nums`}>
                {formatPrice(order.avgPrice)}
              </span>
            </div>
          )}
        </div>

        {order.status === 'partial' && (
          <div className={styles.progressBar}>
            <div
              className={`${styles.progressFill} ${isBuy ? styles.buy : styles.sell}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.timeText}>{formatTime(order.createdAt)}</span>
        {canCancel && onCancel && (
          <button
            className={styles.cancelBtn}
            onClick={(e) => { e.stopPropagation(); onCancel(order.clientOrderId); }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function TradeCard({ fill, order }: {
  fill: PaperOrder['fills'][0];
  order: PaperOrder;
}) {
  const isBuy = order.side === 'buy';
  const value = parseFloat(fill.price) * parseFloat(fill.quantity);

  return (
    <div className={styles.tradeCard}>
      <div className={styles.cardHeader}>
        <div className={styles.symbolRow}>
          <span className={styles.symbolName}>{order.symbol.replace('USDT', '')}</span>
          <span className={styles.symbolQuote}>/USDT</span>
          <span className={`${styles.sideBadge} ${isBuy ? styles.buy : styles.sell}`}>
            {isBuy ? 'BUY' : 'SELL'}
          </span>
        </div>
        <span className={styles.timeText}>{formatTime(fill.time)}</span>
      </div>

      <div className={styles.tradeRow}>
        <div className={styles.tradeItem}>
          <span className={styles.tradeLabel}>Price</span>
          <span className={`${styles.tradeValue} tabular-nums`}>{formatPrice(fill.price)}</span>
        </div>
        <div className={styles.tradeItem}>
          <span className={styles.tradeLabel}>Qty</span>
          <span className={`${styles.tradeValue} tabular-nums`}>{formatQuantity(fill.quantity)}</span>
        </div>
        <div className={styles.tradeItem}>
          <span className={styles.tradeLabel}>Value</span>
          <span className={`${styles.tradeValue} tabular-nums`}>${value.toFixed(2)}</span>
        </div>
        <div className={styles.tradeItem}>
          <span className={styles.tradeLabel}>Fee</span>
          <span className={`${styles.tradeValue} tabular-nums`}>${parseFloat(fill.fee).toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

export function MobileOrdersPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [selectedOrder, setSelectedOrder] = useState<PaperOrder | null>(null);

  const orders = useTradingStore((state) => state.orders);
  const cancelOrder = useTradingStore((state) => state.cancelOrder);

  const openOrders = useMemo(() =>
    orders.filter(o => ['pending', 'submitted', 'open', 'partial'].includes(o.status))
      .sort((a, b) => b.createdAt - a.createdAt)
  , [orders]);

  const historyOrders = useMemo(() =>
    orders.filter(o => ['filled', 'cancelled', 'rejected'].includes(o.status))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  , [orders]);

  const allTrades = useMemo(() =>
    orders.filter(o => o.fills.length > 0)
      .flatMap(order => order.fills.map(fill => ({ fill, order })))
      .sort((a, b) => b.fill.time - a.fill.time)
  , [orders]);

  const tabSegments = [
    { id: 'open' as const, label: t.orders?.open || 'Open', badge: openOrders.length || undefined },
    { id: 'history' as const, label: t.orders?.history || 'History' },
    { id: 'trades' as const, label: t.orders?.trades || 'Trades' },
  ];

  return (
    <div className={styles.container}>
      <MobileHeader title={t.nav?.orders || 'Orders'} />

      {/* Stats Summary */}
      <div className={styles.statsSummary}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{openOrders.length}</span>
          <span className={styles.statLabel}>Open</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{historyOrders.filter(o => o.status === 'filled').length}</span>
          <span className={styles.statLabel}>Filled</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{allTrades.length}</span>
          <span className={styles.statLabel}>Trades</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNav}>
        <MobileSegmentedControl
          segments={tabSegments}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          variant="underline"
        />
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'open' && (
          openOrders.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="inbox" size="xl" />
              <span>No open orders</span>
            </div>
          ) : (
            <div className={styles.orderList}>
              {openOrders.map(order => (
                <OrderCard
                  key={order.clientOrderId}
                  order={order}
                  onCancel={cancelOrder}
                  onSelect={setSelectedOrder}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          historyOrders.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="archive" size="xl" />
              <span>No order history</span>
            </div>
          ) : (
            <div className={styles.orderList}>
              {historyOrders.map(order => (
                <OrderCard
                  key={order.clientOrderId}
                  order={order}
                  onSelect={setSelectedOrder}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'trades' && (
          allTrades.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="activity" size="xl" />
              <span>No trade history</span>
            </div>
          ) : (
            <div className={styles.orderList}>
              {allTrades.map(({ fill, order }, idx) => (
                <TradeCard key={`${order.clientOrderId}-${idx}`} fill={fill} order={order} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Order Detail Drawer */}
      <MobileDrawer
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Order Details"
        height="auto"
      >
        {selectedOrder && (
          <div className={styles.orderDetail}>
            <div className={styles.detailSection}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Symbol</span>
                <span className={styles.detailValue}>{selectedOrder.symbol}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Side</span>
                <span className={`${styles.detailValue} ${selectedOrder.side === 'buy' ? styles.buyText : styles.sellText}`}>
                  {selectedOrder.side.toUpperCase()}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Type</span>
                <span className={styles.detailValue}>{selectedOrder.type.toUpperCase()}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status</span>
                <span className={styles.detailValue}>{getStatusConfig(selectedOrder.status).text}</span>
              </div>
            </div>

            <div className={styles.detailSection}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Price</span>
                <span className={`${styles.detailValue} tabular-nums`}>{formatPrice(selectedOrder.price)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Amount</span>
                <span className={`${styles.detailValue} tabular-nums`}>{formatQuantity(selectedOrder.quantity)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Filled</span>
                <span className={`${styles.detailValue} tabular-nums`}>{formatQuantity(selectedOrder.filledQty)}</span>
              </div>
              {selectedOrder.avgPrice && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Avg Price</span>
                  <span className={`${styles.detailValue} tabular-nums`}>{formatPrice(selectedOrder.avgPrice)}</span>
                </div>
              )}
            </div>

            <div className={styles.detailSection}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Created</span>
                <span className={styles.detailValue}>{formatTime(selectedOrder.createdAt)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Order ID</span>
                <span className={`${styles.detailValue} ${styles.orderId}`}>{selectedOrder.clientOrderId}</span>
              </div>
            </div>
          </div>
        )}
      </MobileDrawer>
    </div>
  );
}

