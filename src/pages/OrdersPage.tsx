import { useState, useMemo, useCallback } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useAutomationStore } from '../store/automationStore';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../components/Icon';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MobileOrdersPage } from './mobile';
import { TriggerList, ExecutionLogList } from '../components/AutomationPanel';
import type { PaperOrder, OrderStatus } from '../types/trading';
import styles from './OrdersPage.module.css';

type TabType = 'open' | 'history' | 'trades' | 'automation' | 'analytics';
type TimeFilter = 'all' | '1d' | '7d' | '30d';

// 格式化时间 - 使用传入的 locale 进行国际化
function formatTime(timestamp: number, compact = false, locale = 'zh-CN'): string {
  if (compact) {
    return new Date(timestamp).toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 格式化价格
function formatPrice(price: string | null): string {
  if (!price) return 'Market';
  const num = parseFloat(price);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(8);
}

// 格式化数量
function formatQuantity(qty: string): string {
  const num = parseFloat(qty);
  if (num >= 100) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

// 格式化美元
function formatUSD(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

// 获取状态显示
function getStatusConfig(status: OrderStatus): { text: string; className: string; icon: IconName } {
  const configs: Record<OrderStatus, { text: string; className: string; icon: IconName }> = {
    pending: { text: 'Pending', className: styles.statusPending || '', icon: 'clock' },
    submitted: { text: 'Submitted', className: styles.statusSubmitted || '', icon: 'send' },
    open: { text: 'Open', className: styles.statusOpen || '', icon: 'radio' },
    partial: { text: 'Partial', className: styles.statusPartial || '', icon: 'pie-chart' },
    filled: { text: 'Filled', className: styles.statusFilled || '', icon: 'check-circle' },
    cancelled: { text: 'Cancelled', className: styles.statusCancelled || '', icon: 'x-circle' },
    rejected: { text: 'Rejected', className: styles.statusRejected || '', icon: 'alert-circle' },
    expired: { text: 'Expired', className: styles.statusCancelled || '', icon: 'clock' },
    triggered: { text: 'Triggered', className: styles.statusOpen || '', icon: 'zap' },
  };
  return configs[status] || { text: status, className: '', icon: 'circle' };
}

// Mini Sparkline 组件
function MiniSparkline({ data, color }: { data: number[]; color: 'green' | 'red' | 'blue' }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 20;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const colorMap = {
    green: 'var(--color-price-up)',
    red: 'var(--color-price-down)',
    blue: 'var(--color-info)',
  };

  return (
    <svg width={width} height={height} className={styles.sparkline}>
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 统计卡片组件
function StatCard({ 
  label, 
  value, 
  subValue, 
  trend, 
  icon, 
  sparkData,
  sparkColor,
  highlight 
}: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: IconName;
  sparkData?: number[];
  sparkColor?: 'green' | 'red' | 'blue';
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.statCard} ${highlight ? styles.highlight : ''}`}>
      <div className={styles.statHeader}>
        <Icon name={icon} size="sm" className={styles.statIcon} />
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statBody}>
        <span className={`${styles.statValue} ${trend === 'up' ? 'price-up' : trend === 'down' ? 'price-down' : ''}`}>
          {value}
        </span>
        {sparkData && sparkColor && <MiniSparkline data={sparkData} color={sparkColor} />}
      </div>
      {subValue && (
        <span className={styles.statSubValue}>{subValue}</span>
      )}
    </div>
  );
}

// 订单表格行组件
function OrderTableRow({ 
  order, 
  onCancel, 
  onViewDetails,
  compact: _compact = false,
  locale = 'zh-CN',
}: { 
  order: PaperOrder; 
  onCancel?: (id: string) => void; 
  onViewDetails?: (order: PaperOrder) => void; 
  compact?: boolean;
  locale?: string;
}) {
  const status = getStatusConfig(order.status);
  const canCancel = ['pending', 'open', 'partial'].includes(order.status);
  const isBuy = order.side === 'buy';
  
  const filledValue = order.fills.reduce((sum, fill) => {
    return sum + parseFloat(fill.price) * parseFloat(fill.quantity);
  }, 0);
  
  const fillPercent = parseFloat(order.quantity) > 0 
    ? (parseFloat(order.filledQty) / parseFloat(order.quantity)) * 100 
    : 0;

  return (
    <tr className={styles.orderRow}>
      <td className={styles.timeCell}>
        <span className={styles.timeMain}>{formatTime(order.createdAt, true, locale)}</span>
      </td>
      <td className={styles.symbolCell}>
        <div className={styles.symbolWrapper}>
          <span className={styles.symbolName}>{order.symbol.replace('USDT', '')}</span>
          <span className={styles.symbolQuote}>/USDT</span>
        </div>
      </td>
      <td className={styles.sideCell}>
        <span className={`${styles.sideBadge} ${isBuy ? styles.buy : styles.sell}`}>
          {isBuy ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className={styles.typeCell}>
        <span className={styles.typeBadge}>
          {order.type === 'limit' ? 'LIMIT' : 'MARKET'}
        </span>
      </td>
      <td className={`${styles.priceCell} tabular-nums`}>
        {formatPrice(order.price)}
      </td>
      <td className={`${styles.amountCell} tabular-nums`}>
        <div className={styles.amountWrapper}>
          <span>{formatQuantity(order.filledQty)}</span>
          <span className={styles.amountDivider}>/</span>
          <span className={styles.amountTotal}>{formatQuantity(order.quantity)}</span>
        </div>
        {order.status === 'partial' && (
          <div className={styles.fillProgress}>
            <div 
              className={`${styles.fillProgressBar} ${isBuy ? styles.buy : styles.sell}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        )}
      </td>
      <td className={`${styles.avgCell} tabular-nums`}>
        {order.avgPrice && parseFloat(order.avgPrice) > 0 ? formatPrice(order.avgPrice) : '—'}
      </td>
      <td className={`${styles.valueCell} tabular-nums`}>
        {filledValue > 0 ? formatUSD(filledValue) : '—'}
      </td>
      <td className={styles.statusCell}>
        <div className={`${styles.statusBadge} ${status.className}`}>
          <Icon name={status.icon} size="xs" />
          <span>{status.text}</span>
        </div>
      </td>
      <td className={styles.actionsCell}>
        {canCancel && onCancel && (
          <button 
            className={styles.cancelBtn}
            onClick={() => onCancel(order.clientOrderId)}
            title="Cancel Order"
          >
            <Icon name="x" size="xs" />
          </button>
        )}
        {onViewDetails && (
          <button 
            className={styles.detailsBtn}
            onClick={() => onViewDetails(order)}
            title="View Details"
          >
            <Icon name="eye" size="xs" />
          </button>
        )}
      </td>
    </tr>
  );
}

// 成交记录表格行
function TradeTableRow({ 
  fill, 
  order,
  locale = 'zh-CN',
}: { 
  fill: PaperOrder['fills'][0]; 
  order: PaperOrder;
  locale?: string;
}) {
  const isBuy = order.side === 'buy';
  const value = parseFloat(fill.price) * parseFloat(fill.quantity);
  
  return (
    <tr className={styles.tradeRow}>
      <td className={styles.timeCell}>
        <span className={styles.timeMain}>{formatTime(fill.time, true, locale)}</span>
      </td>
      <td className={styles.symbolCell}>
        <div className={styles.symbolWrapper}>
          <span className={styles.symbolName}>{order.symbol.replace('USDT', '')}</span>
          <span className={styles.symbolQuote}>/USDT</span>
        </div>
      </td>
      <td className={styles.sideCell}>
        <span className={`${styles.sideBadge} ${isBuy ? styles.buy : styles.sell}`}>
          {isBuy ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className={`${styles.priceCell} tabular-nums`}>
        {formatPrice(fill.price)}
      </td>
      <td className={`${styles.amountCell} tabular-nums`}>
        {formatQuantity(fill.quantity)}
      </td>
      <td className={`${styles.valueCell} tabular-nums`}>
        {formatUSD(value)}
      </td>
      <td className={`${styles.feeCell} tabular-nums`}>
        ${parseFloat(fill.fee).toFixed(4)}
      </td>
    </tr>
  );
}

// 订单详情抽屉
function OrderDetailDrawer({ 
  order, 
  onClose,
  locale = 'zh-CN',
}: { 
  order: PaperOrder | null; 
  onClose: () => void;
  locale?: string;
}) {
  if (!order) return null;
  
  const status = getStatusConfig(order.status);
  const isBuy = order.side === 'buy';
  const filledValue = order.fills.reduce((sum, fill) => 
    sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0);
  const totalFee = order.fills.reduce((sum, fill) => sum + parseFloat(fill.fee), 0);

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Order Details</h3>
          <button className={styles.drawerClose} onClick={onClose}>
            <Icon name="x" size="sm" />
          </button>
        </div>
        
        <div className={styles.drawerBody}>
          {/* Order Summary */}
          <div className={styles.detailSection}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Symbol</span>
              <span className={styles.detailValue}>{order.symbol}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Side</span>
              <span className={`${styles.detailValue} ${isBuy ? 'price-up' : 'price-down'}`}>
                {isBuy ? 'BUY' : 'SELL'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type</span>
              <span className={styles.detailValue}>{order.type.toUpperCase()}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status</span>
              <div className={`${styles.statusBadge} ${status.className}`}>
                <Icon name={status.icon} size="xs" />
                <span>{status.text}</span>
              </div>
            </div>
          </div>

          {/* Price & Amount */}
          <div className={styles.detailSection}>
            <h4 className={styles.sectionTitle}>Price & Amount</h4>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Price</span>
              <span className={`${styles.detailValue} tabular-nums`}>{formatPrice(order.price)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Amount</span>
              <span className={`${styles.detailValue} tabular-nums`}>{formatQuantity(order.quantity)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Filled Amount</span>
              <span className={`${styles.detailValue} tabular-nums`}>{formatQuantity(order.filledQty)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Avg Fill Price</span>
              <span className={`${styles.detailValue} tabular-nums`}>
                {order.avgPrice ? formatPrice(order.avgPrice) : '—'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Total Value</span>
              <span className={`${styles.detailValue} tabular-nums`}>
                {filledValue > 0 ? formatUSD(filledValue) : '—'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Total Fees</span>
              <span className={`${styles.detailValue} tabular-nums`}>
                ${totalFee.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className={styles.detailSection}>
            <h4 className={styles.sectionTitle}>Timeline</h4>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Created</span>
              <span className={`${styles.detailValue} tabular-nums`}>{formatTime(order.createdAt, false, locale)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Updated</span>
              <span className={`${styles.detailValue} tabular-nums`}>{formatTime(order.updatedAt, false, locale)}</span>
            </div>
          </div>

          {/* Fills */}
          {order.fills.length > 0 && (
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>Fills ({order.fills.length})</h4>
              <div className={styles.fillsList}>
                {order.fills.map((fill, idx) => (
                  <div key={idx} className={styles.fillItem}>
                    <div className={styles.fillMain}>
                      <span className={`tabular-nums`}>{formatQuantity(fill.quantity)}</span>
                      <span className={styles.fillAt}>@</span>
                      <span className={`tabular-nums`}>{formatPrice(fill.price)}</span>
                    </div>
                    <div className={styles.fillMeta}>
                      <span className={styles.fillTime}>{formatTime(fill.time, true, locale)}</span>
                      <span className={styles.fillFee}>Fee: ${parseFloat(fill.fee).toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order ID */}
          <div className={styles.detailSection}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order ID</span>
              <span className={`${styles.detailValue} ${styles.orderId}`}>{order.clientOrderId}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 性能分析面板
function AnalyticsPanel({ orders, trades }: { orders: PaperOrder[]; trades: { fill: PaperOrder['fills'][0]; order: PaperOrder }[] }) {
  // 计算各种统计数据
  const filledOrders = orders.filter(o => o.status === 'filled');
  
  // 按交易对分组
  const bySymbol = useMemo(() => {
    const map = new Map<string, { volume: number; trades: number; fees: number }>();
    trades.forEach(({ fill, order }) => {
      const current = map.get(order.symbol) || { volume: 0, trades: 0, fees: 0 };
      current.volume += parseFloat(fill.price) * parseFloat(fill.quantity);
      current.trades += 1;
      current.fees += parseFloat(fill.fee);
      map.set(order.symbol, current);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].volume - a[1].volume);
  }, [trades]);

  // 按日期分组
  const byDate = useMemo(() => {
    const map = new Map<string, { volume: number; trades: number }>();
    trades.forEach(({ fill }) => {
      const date = new Date(fill.time).toLocaleDateString('en-CA'); // YYYY-MM-DD format
      const current = map.get(date) || { volume: 0, trades: 0 };
      current.volume += parseFloat(fill.price) * parseFloat(fill.quantity);
      current.trades += 1;
      map.set(date, current);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
  }, [trades]);

  const totalVolume = trades.reduce((sum, { fill }) => 
    sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0);
  const totalFees = trades.reduce((sum, { fill }) => sum + parseFloat(fill.fee), 0);
  const avgOrderSize = trades.length > 0 ? totalVolume / trades.length : 0;
  
  // 买卖比例
  const buyVolume = trades
    .filter(({ order }) => order.side === 'buy')
    .reduce((sum, { fill }) => sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0);
  const sellVolume = totalVolume - buyVolume;
  const buyRatio = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;

  return (
    <div className={styles.analyticsPanel}>
      {/* Summary Stats Row */}
      <div className={styles.analyticsRow}>
        <div className={styles.analyticsStat}>
          <span className={styles.analyticsLabel}>Total Volume</span>
          <span className={styles.analyticsValue}>{formatUSD(totalVolume)}</span>
        </div>
        <div className={styles.analyticsStat}>
          <span className={styles.analyticsLabel}>Total Trades</span>
          <span className={styles.analyticsValue}>{trades.length}</span>
        </div>
        <div className={styles.analyticsStat}>
          <span className={styles.analyticsLabel}>Avg Trade Size</span>
          <span className={styles.analyticsValue}>{formatUSD(avgOrderSize)}</span>
        </div>
        <div className={styles.analyticsStat}>
          <span className={styles.analyticsLabel}>Total Fees</span>
          <span className={styles.analyticsValue}>${totalFees.toFixed(2)}</span>
        </div>
        <div className={styles.analyticsStat}>
          <span className={styles.analyticsLabel}>Completed Orders</span>
          <span className={styles.analyticsValue}>{filledOrders.length}</span>
        </div>
      </div>

      <div className={styles.analyticsGrid}>
        {/* Buy/Sell Ratio */}
        <div className={styles.analyticsCard}>
          <h4 className={styles.analyticsCardTitle}>Buy / Sell Ratio</h4>
          <div className={styles.ratioBar}>
            <div className={styles.ratioBarBuy} style={{ width: `${buyRatio}%` }} />
            <div className={styles.ratioBarSell} style={{ width: `${100 - buyRatio}%` }} />
          </div>
          <div className={styles.ratioLabels}>
            <span className={styles.ratioLabelBuy}>Buy {buyRatio.toFixed(1)}%</span>
            <span className={styles.ratioLabelSell}>Sell {(100 - buyRatio).toFixed(1)}%</span>
          </div>
          <div className={styles.ratioValues}>
            <span>{formatUSD(buyVolume)}</span>
            <span>{formatUSD(sellVolume)}</span>
          </div>
        </div>

        {/* Volume by Symbol */}
        <div className={styles.analyticsCard}>
          <h4 className={styles.analyticsCardTitle}>Volume by Asset</h4>
          <div className={styles.symbolList}>
            {bySymbol.slice(0, 5).map(([symbol, data]) => (
              <div key={symbol} className={styles.symbolItem}>
                <div className={styles.symbolInfo}>
                  <span className={styles.symbolName}>{symbol.replace('USDT', '')}</span>
                  <span className={styles.symbolTrades}>{data.trades} trades</span>
                </div>
                <span className={styles.symbolVolume}>{formatUSD(data.volume)}</span>
              </div>
            ))}
            {bySymbol.length === 0 && (
              <div className={styles.emptyState}>No trading data</div>
            )}
          </div>
        </div>

        {/* Daily Volume Chart */}
        <div className={styles.analyticsCard}>
          <h4 className={styles.analyticsCardTitle}>Daily Volume (Last 7 Days)</h4>
          <div className={styles.barChart}>
            {byDate.map(([date, data]) => {
              const maxVol = Math.max(...byDate.map(d => d[1].volume));
              const height = maxVol > 0 ? (data.volume / maxVol) * 100 : 0;
              return (
                <div key={date} className={styles.barWrapper}>
                  <div 
                    className={styles.bar}
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${date}: ${formatUSD(data.volume)}`}
                  />
                  <span className={styles.barLabel}>
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
            {byDate.length === 0 && (
              <div className={styles.emptyState}>No data for this period</div>
            )}
          </div>
        </div>

        {/* Order Types Breakdown */}
        <div className={styles.analyticsCard}>
          <h4 className={styles.analyticsCardTitle}>Order Completion Rate</h4>
          <div className={styles.completionStats}>
            <div className={styles.completionItem}>
              <span className={styles.completionLabel}>Filled</span>
              <span className={`${styles.completionValue} ${styles.filled}`}>
                {orders.filter(o => o.status === 'filled').length}
              </span>
            </div>
            <div className={styles.completionItem}>
              <span className={styles.completionLabel}>Cancelled</span>
              <span className={`${styles.completionValue} ${styles.cancelled}`}>
                {orders.filter(o => o.status === 'cancelled').length}
              </span>
            </div>
            <div className={styles.completionItem}>
              <span className={styles.completionLabel}>Rejected</span>
              <span className={`${styles.completionValue} ${styles.rejected}`}>
                {orders.filter(o => o.status === 'rejected').length}
              </span>
            </div>
            <div className={styles.completionItem}>
              <span className={styles.completionLabel}>Open</span>
              <span className={`${styles.completionValue} ${styles.open}`}>
                {orders.filter(o => ['pending', 'open', 'partial'].includes(o.status)).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const isMobile = useIsMobile();
  const { t: _t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('open');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');

  // Render mobile layout
  if (isMobile) {
    return <MobileOrdersPage />;
  }
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PaperOrder | null>(null);
  
  const orders = useTradingStore((state) => state.orders);
  const cancelOrder = useTradingStore((state) => state.cancelOrder);
  const triggers = useAutomationStore((state) => state.triggers);

  // 时间过滤
  const filterByTime = useCallback((timestamp: number) => {
    if (timeFilter === 'all') return true;
    const now = Date.now();
    const days = { '1d': 1, '7d': 7, '30d': 30 }[timeFilter] || 0;
    return timestamp > now - days * 24 * 60 * 60 * 1000;
  }, [timeFilter]);

  // 分类订单
  const openOrders = useMemo(() => 
    orders.filter(o => 
      ['pending', 'submitted', 'open', 'partial'].includes(o.status) &&
      filterByTime(o.createdAt) &&
      (symbolFilter === 'all' || o.symbol === symbolFilter) &&
      (sideFilter === 'all' || o.side === sideFilter) &&
      (searchQuery === '' || o.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => b.createdAt - a.createdAt)
  , [orders, filterByTime, symbolFilter, sideFilter, searchQuery]);
  
  const historyOrders = useMemo(() => 
    orders.filter(o => 
      ['filled', 'cancelled', 'rejected'].includes(o.status) &&
      filterByTime(o.updatedAt) &&
      (symbolFilter === 'all' || o.symbol === symbolFilter) &&
      (sideFilter === 'all' || o.side === sideFilter) &&
      (searchQuery === '' || o.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => b.updatedAt - a.updatedAt)
  , [orders, filterByTime, symbolFilter, sideFilter, searchQuery]);
  
  // 所有成交记录
  const allTrades = useMemo(() => 
    orders
      .filter(o => 
        o.fills.length > 0 &&
        (symbolFilter === 'all' || o.symbol === symbolFilter) &&
        (sideFilter === 'all' || o.side === sideFilter) &&
        (searchQuery === '' || o.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .flatMap(order => order.fills.filter(fill => filterByTime(fill.time)).map(fill => ({ fill, order })))
      .sort((a, b) => b.fill.time - a.fill.time)
  , [orders, filterByTime, symbolFilter, sideFilter, searchQuery]);

  // 唯一交易对列表
  const uniqueSymbols = useMemo(() => 
    [...new Set(orders.map(o => o.symbol))].sort()
  , [orders]);

  // 统计数据
  const stats = useMemo(() => {
    const filled = orders.filter(o => o.status === 'filled').length;
    const totalTrades = allTrades.length;
    const totalVolume = allTrades.reduce((sum, { fill }) => 
      sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0);
    const totalFees = allTrades.reduce((sum, { fill }) => sum + parseFloat(fill.fee), 0);
    const avgFillPrice = totalTrades > 0 
      ? allTrades.reduce((sum, { fill }) => sum + parseFloat(fill.price), 0) / totalTrades 
      : 0;
    
    // 最近一小时交易量
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentTrades = allTrades.filter(({ fill }) => fill.time > oneHourAgo);
    const recentVolume = recentTrades.reduce((sum, { fill }) => 
      sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0);
    
    // 每日交易量趋势
    const dailyVolumes: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayVolume = allTrades
        .filter(({ fill }) => fill.time >= dayStart.getTime() && fill.time < dayEnd.getTime())
        .reduce((sum, { fill }) => sum + parseFloat(fill.price) * parseFloat(fill.quantity), 0);
      dailyVolumes.push(dayVolume);
    }

    return {
      openCount: openOrders.length,
      filled,
      totalTrades,
      totalVolume,
      totalFees,
      avgFillPrice,
      recentVolume,
      dailyVolumes,
      triggerCount: triggers.filter(t => t.enabled).length,
    };
  }, [orders, allTrades, openOrders.length, triggers]);
  
  const handleCancel = (clientOrderId: string) => {
    cancelOrder(clientOrderId);
  };

  return (
    <div className={styles.container}>
      {/* Header Dashboard */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>
              <Icon name="layers" size="lg" />
              Order Management
            </h1>
            <span className={styles.simulatedBadge}>Paper Trading</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.exportBtn}>
              <Icon name="download" size="sm" />
              Export
            </button>
          </div>
        </div>
        
        {/* Stats Dashboard */}
        <div className={styles.statsGrid}>
          <StatCard 
            label="Open Orders" 
            value={stats.openCount} 
            icon="list"
            highlight={stats.openCount > 0}
          />
          <StatCard 
            label="Filled Orders" 
            value={stats.filled} 
            icon="check-circle"
          />
          <StatCard 
            label="Total Trades" 
            value={stats.totalTrades} 
            icon="activity"
          />
          <StatCard 
            label="Total Volume" 
            value={formatUSD(stats.totalVolume)} 
            icon="bar-chart-2"
            sparkData={stats.dailyVolumes}
            sparkColor="blue"
          />
          <StatCard 
            label="1H Volume" 
            value={formatUSD(stats.recentVolume)} 
            icon="clock"
          />
          <StatCard 
            label="Total Fees" 
            value={`$${stats.totalFees.toFixed(2)}`} 
            icon="percent"
          />
          <StatCard 
            label="Active Triggers" 
            value={stats.triggerCount} 
            icon="zap"
            highlight={stats.triggerCount > 0}
          />
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'open' ? styles.active : ''}`}
            onClick={() => setActiveTab('open')}
          >
            <Icon name="list" size="xs" />
            Open Orders
            {stats.openCount > 0 && <span className={styles.badge}>{stats.openCount}</span>}
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Icon name="history" size="xs" />
            Order History
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'trades' ? styles.active : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            <Icon name="repeat" size="xs" />
            Trade History
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'automation' ? styles.active : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            <Icon name="zap" size="xs" />
            Automation
            {stats.triggerCount > 0 && <span className={styles.badge}>{stats.triggerCount}</span>}
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'analytics' ? styles.active : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <Icon name="pie-chart" size="xs" />
            Analytics
          </button>
        </div>

        {/* Filters */}
        {activeTab !== 'automation' && activeTab !== 'analytics' && (
          <div className={styles.filters}>
            <div className={styles.searchWrapper}>
              <Icon name="search" size="xs" className={styles.searchIcon} />
              <input 
                type="text"
                className={styles.searchInput}
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select 
              className={styles.filterSelect}
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
            >
              <option value="all">All Assets</option>
              {uniqueSymbols.map(s => (
                <option key={s} value={s}>{s.replace('USDT', '')}/USDT</option>
              ))}
            </select>

            <select 
              className={styles.filterSelect}
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as any)}
            >
              <option value="all">All Sides</option>
              <option value="buy">Buy Only</option>
              <option value="sell">Sell Only</option>
            </select>

            <div className={styles.timeFilters}>
              {(['all', '1d', '7d', '30d'] as TimeFilter[]).map(tf => (
                <button 
                  key={tf}
                  className={`${styles.timeFilter} ${timeFilter === tf ? styles.active : ''}`}
                  onClick={() => setTimeFilter(tf)}
                >
                  {tf === 'all' ? 'All' : tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'open' && (
          <div className={styles.tableContainer}>
            {openOrders.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="inbox" size="xl" />
                <h3>No Open Orders</h3>
                <p>Your active orders will appear here</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Filled / Amount</th>
                    <th>Avg Price</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map(order => (
                    <OrderTableRow 
                      key={order.clientOrderId} 
                      order={order}
                      onCancel={handleCancel}
                      onViewDetails={setSelectedOrder}
                      locale={locale}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className={styles.tableContainer}>
            {historyOrders.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="archive" size="xl" />
                <h3>No Order History</h3>
                <p>Your completed orders will appear here</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Filled / Amount</th>
                    <th>Avg Price</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyOrders.map(order => (
                    <OrderTableRow 
                      key={order.clientOrderId} 
                      order={order}
                      onViewDetails={setSelectedOrder}
                      locale={locale}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className={styles.tableContainer}>
            {allTrades.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="activity" size="xl" />
                <h3>No Trade History</h3>
                <p>Your executed trades will appear here</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Amount</th>
                    <th>Value</th>
                    <th>Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {allTrades.map(({ fill, order }, index) => (
                    <TradeTableRow 
                      key={`${order.clientOrderId}-${fill.time}-${index}`}
                      fill={fill}
                      order={order}
                      locale={locale}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'automation' && (
          <div className={styles.automationLayout}>
            <div className={styles.automationMain}>
              <div className={styles.automationSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <Icon name="zap" size="sm" />
                    Active Triggers
                  </h3>
                  <span className={styles.sectionCount}>{triggers.length}</span>
                </div>
                <TriggerList />
              </div>
            </div>
            <div className={styles.automationSidebar}>
              <div className={styles.automationSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <Icon name="scroll" size="sm" />
                    Execution Log
                  </h3>
                </div>
                <ExecutionLogList />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPanel orders={orders} trades={allTrades} />
        )}
      </div>

      {/* Order Detail Drawer */}
      <OrderDetailDrawer 
        order={selectedOrder} 
        onClose={() => setSelectedOrder(null)}
        locale={locale}
      />
    </div>
  );
}
