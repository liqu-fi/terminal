import { useState } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import type { PaperOrder, OrderStatus } from '../types/trading';
import styles from './OrdersPage.module.css';

type TabType = 'open' | 'history' | 'trades';

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 格式化价格
function formatPrice(price: string | null): string {
  if (!price) return '市价';
  const num = parseFloat(price);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(8);
}

// 格式化数量
function formatQuantity(qty: string): string {
  const num = parseFloat(qty);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

// 获取状态显示
function getStatusDisplay(status: OrderStatus, t: ReturnType<typeof useI18n>['t']): { text: string; className: string } {
  const statusMap: Record<OrderStatus, { text: string; className: string }> = {
    pending: { text: t.orders?.status?.pending || '待提交', className: styles.statusPending },
    submitted: { text: t.orders?.status?.submitted || '已提交', className: styles.statusSubmitted },
    open: { text: t.orders?.status?.open || '挂单中', className: styles.statusOpen },
    partial: { text: t.orders?.status?.partial || '部分成交', className: styles.statusPartial },
    filled: { text: t.orders?.status?.filled || '已成交', className: styles.statusFilled },
    cancelled: { text: t.orders?.status?.cancelled || '已取消', className: styles.statusCancelled },
    rejected: { text: t.orders?.status?.rejected || '已拒绝', className: styles.statusRejected },
  };
  return statusMap[status] || { text: status, className: '' };
}

// 订单行组件
function OrderRow({ order, onCancel, t }: { order: PaperOrder; onCancel?: (id: string) => void; t: ReturnType<typeof useI18n>['t'] }) {
  const status = getStatusDisplay(order.status, t);
  const canCancel = ['pending', 'open', 'partial'].includes(order.status);
  const isBuy = order.side === 'buy';
  
  // 计算成交金额
  const filledValue = order.fills.reduce((sum, fill) => {
    return sum + parseFloat(fill.price) * parseFloat(fill.quantity);
  }, 0);
  
  // 计算手续费
  const totalFee = order.fills.reduce((sum, fill) => sum + parseFloat(fill.fee), 0);

  return (
    <div className={styles.orderRow}>
      <div className={styles.orderMain}>
        <div className={styles.orderSymbol}>
          <span className={styles.symbol}>{order.symbol}</span>
          <span className={`${styles.side} ${isBuy ? styles.buy : styles.sell}`}>
            {isBuy ? (t.orders?.buy || '买入') : (t.orders?.sell || '卖出')}
          </span>
          <span className={styles.type}>
            {order.type === 'limit' ? (t.orders?.limit || '限价') : (t.orders?.market || '市价')}
          </span>
        </div>
        <span className={`${styles.status} ${status.className}`}>{status.text}</span>
      </div>
      
      <div className={styles.orderDetails}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.price || '价格'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {formatPrice(order.price)}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.quantity || '数量'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {formatQuantity(order.filledQty)}/{formatQuantity(order.quantity)}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.avgPrice || '均价'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {order.avgPrice && parseFloat(order.avgPrice) > 0 ? formatPrice(order.avgPrice) : '--'}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.value || '金额'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {filledValue > 0 ? `$${filledValue.toFixed(2)}` : '--'}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.fee || '手续费'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {totalFee > 0 ? `$${totalFee.toFixed(4)}` : '--'}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.time || '时间'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>
            {formatTime(order.createdAt)}
          </span>
        </div>
      </div>
      
      {canCancel && onCancel && (
        <button 
          className={styles.cancelBtn}
          onClick={() => onCancel(order.clientOrderId)}
        >
          <Icon name="x" size="sm" />
          {t.orders?.cancel || '取消'}
        </button>
      )}
    </div>
  );
}

// 成交记录行组件
function TradeRow({ fill, order, t }: { fill: PaperOrder['fills'][0]; order: PaperOrder; t: ReturnType<typeof useI18n>['t'] }) {
  const isBuy = order.side === 'buy';
  const value = parseFloat(fill.price) * parseFloat(fill.quantity);
  
  return (
    <div className={styles.tradeRow}>
      <div className={styles.tradeMain}>
        <span className={styles.symbol}>{order.symbol}</span>
        <span className={`${styles.side} ${isBuy ? styles.buy : styles.sell}`}>
          {isBuy ? (t.orders?.buy || '买入') : (t.orders?.sell || '卖出')}
        </span>
      </div>
      <div className={styles.tradeDetails}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.price || '价格'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>{formatPrice(fill.price)}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.quantity || '数量'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>{formatQuantity(fill.quantity)}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.value || '金额'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>${value.toFixed(2)}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.fee || '手续费'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>${parseFloat(fill.fee).toFixed(4)}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>{t.orders?.time || '时间'}</span>
          <span className={`${styles.detailValue} tabular-nums`}>{formatTime(fill.time)}</span>
        </div>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('open');
  
  const orders = useTradingStore((state) => state.orders);
  const cancelOrder = useTradingStore((state) => state.cancelOrder);
  
  // 分类订单
  const openOrders = orders.filter(o => 
    ['pending', 'submitted', 'open', 'partial'].includes(o.status)
  ).sort((a, b) => b.createdAt - a.createdAt);
  
  const historyOrders = orders.filter(o => 
    ['filled', 'cancelled', 'rejected'].includes(o.status)
  ).sort((a, b) => b.updatedAt - a.updatedAt);
  
  // 所有成交记录
  const allTrades = orders
    .filter(o => o.fills.length > 0)
    .flatMap(order => order.fills.map(fill => ({ fill, order })))
    .sort((a, b) => b.fill.time - a.fill.time);
  
  const handleCancel = (clientOrderId: string) => {
    cancelOrder(clientOrderId);
  };

  return (
    <div className={styles.container}>
      {/* 统计摘要 */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryValue}>{openOrders.length}</span>
          <span className={styles.summaryLabel}>{t.orders?.openOrders || '活动订单'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryValue}>{historyOrders.filter(o => o.status === 'filled').length}</span>
          <span className={styles.summaryLabel}>{t.orders?.filledOrders || '已成交'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryValue}>{allTrades.length}</span>
          <span className={styles.summaryLabel}>{t.orders?.totalTrades || '成交笔数'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryValue}>
            ${allTrades.reduce((sum, { fill }) => 
              sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0
            ).toFixed(2)}
          </span>
          <span className={styles.summaryLabel}>{t.orders?.totalVolume || '成交金额'}</span>
        </div>
      </div>

      {/* 标签页 */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'open' ? styles.active : ''}`}
          onClick={() => setActiveTab('open')}
        >
          {t.orders?.openTab || '活动订单'}
          {openOrders.length > 0 && (
            <span className={styles.badge}>{openOrders.length}</span>
          )}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {t.orders?.historyTab || '历史订单'}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'trades' ? styles.active : ''}`}
          onClick={() => setActiveTab('trades')}
        >
          {t.orders?.tradesTab || '成交记录'}
        </button>
      </div>

      {/* 内容区 */}
      <div className={styles.content}>
        {activeTab === 'open' && (
          <div className={styles.orderList}>
            {openOrders.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="inbox" size="lg" />
                <span>{t.orders?.noOpenOrders || '暂无活动订单'}</span>
              </div>
            ) : (
              openOrders.map(order => (
                <OrderRow 
                  key={order.clientOrderId} 
                  order={order} 
                  onCancel={handleCancel}
                  t={t}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className={styles.orderList}>
            {historyOrders.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="archive" size="lg" />
                <span>{t.orders?.noHistory || '暂无历史订单'}</span>
              </div>
            ) : (
              historyOrders.map(order => (
                <OrderRow 
                  key={order.clientOrderId} 
                  order={order}
                  t={t}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className={styles.tradeList}>
            {allTrades.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="activity" size="lg" />
                <span>{t.orders?.noTrades || '暂无成交记录'}</span>
              </div>
            ) : (
              allTrades.map(({ fill, order }, index) => (
                <TradeRow 
                  key={`${order.clientOrderId}-${fill.time}-${index}`}
                  fill={fill}
                  order={order}
                  t={t}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
