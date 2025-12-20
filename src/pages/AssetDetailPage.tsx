import { useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, selectBalances, selectAccount } from '../store/walletStore';
import { useTradingStore } from '../store/tradingStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { useAutomationStore } from '../store/automationStore';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../components/Icon';
import { Sparkline } from '../components/Chart/Sparkline';
import styles from './AssetDetailPage.module.css';
import Decimal from 'decimal.js';

type TimeRange = '1D' | '7D' | '30D' | 'ALL';
type SortField = 'value' | 'balance' | 'pnl' | 'pnlPercent';
type SortOrder = 'asc' | 'desc';

// 格式化数字
function formatNumber(value: number, decimals = 2): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(decimals)}`;
}

function formatPercent(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

// 增强型投资组合图表组件
function PortfolioChart({ 
  data, 
  color, 
  height = 100,
  timeRange 
}: { 
  data: number[]; 
  color: string; 
  height?: number;
  timeRange: TimeRange;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = { top: 8, right: 60, bottom: 24, left: 8 };
  const chartWidth = 560;
  // 使用一个合理的默认高度，SVG 会通过 CSS 自适应容器
  const chartHeight = height;
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  
  // 计算点坐标
  const points = data.map((v, i) => {
    const x = padding.left + (i / (data.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - ((v - min) / range) * graphHeight;
    return { x, y, value: v };
  });
  
  const pathPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${padding.left},${padding.top + graphHeight} ${pathPoints} ${padding.left + graphWidth},${padding.top + graphHeight}`;
  
  // 生成Y轴刻度
  const yTicks = [min, (min + max) / 2, max];
  
  // 生成X轴时间标签
  const getTimeLabels = () => {
    const now = new Date();
    switch (timeRange) {
      case '1D':
        return ['00:00', '06:00', '12:00', '18:00', 'Now'];
      case '7D':
        return Array.from({ length: 5 }, (_, i) => {
          const d = new Date(now.getTime() - (4 - i) * 24 * 60 * 60 * 1000 * 1.75);
          return d.toLocaleDateString('en-US', { weekday: 'short' });
        });
      case '30D':
        return Array.from({ length: 5 }, (_, i) => {
          const d = new Date(now.getTime() - (4 - i) * 24 * 60 * 60 * 1000 * 7.5);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
      case 'ALL':
        return ['Start', '', '', '', 'Now'];
      default:
        return [];
    }
  };
  
  const timeLabels = getTimeLabels();
  const startValue = data.length > 0 ? (data[0] || 0) : 0;
  const endValue = data.length > 0 ? (data[data.length - 1] || 0) : 0;
  const changeValue = endValue - startValue;
  const changePercent = startValue !== 0 ? ((changeValue / startValue) * 100).toFixed(2) : '0.00';
  
  // 格式化数值
  const formatValue = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;
  
  return (
    <div className={styles.portfolioChart}>
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.chartSvg}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="portfolio-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="50%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 网格线 */}
        <g className={styles.gridLines}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + graphHeight * ratio}
              x2={padding.left + graphWidth}
              y2={padding.top + graphHeight * ratio}
              stroke="var(--border-light)"
              strokeWidth="1"
              strokeDasharray={i === 2 ? "none" : "3,3"}
              opacity={i === 2 ? 0.5 : 0.3}
            />
          ))}
        </g>
        
        {/* 填充区域 */}
        <polygon 
          points={areaPoints} 
          fill="url(#portfolio-gradient)" 
        />
        
        {/* 主曲线 */}
        <polyline
          points={pathPoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        
        {/* Y轴标签 */}
        <g className={styles.yAxis}>
          {yTicks.map((tick, i) => {
            const y = padding.top + graphHeight - ((tick - min) / range) * graphHeight;
            return (
              <text
                key={i}
                x={chartWidth - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--text-tertiary)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {formatValue(tick)}
              </text>
            );
          })}
        </g>
        
        {/* X轴标签 */}
        <g className={styles.xAxis}>
          {timeLabels.map((label, i) => {
            const x = padding.left + (i / (timeLabels.length - 1)) * graphWidth;
            return (
              <text
                key={i}
                x={x}
                y={chartHeight - 4}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="9"
                fontFamily="var(--font-mono)"
              >
                {label}
              </text>
            );
          })}
        </g>
        
        {/* 交互层 - 透明矩形用于检测鼠标位置 */}
        {points.map((point, i) => (
          <rect
            key={i}
            x={point.x - graphWidth / (data.length * 2)}
            y={padding.top}
            width={graphWidth / data.length}
            height={graphHeight}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}
        
        {/* 悬停指示器 */}
        {hoveredPoint && (
          <g>
            <line
              x1={hoveredPoint.x}
              y1={padding.top}
              x2={hoveredPoint.x}
              y2={padding.top + graphHeight}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.6"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="5"
              fill={color}
              stroke="var(--bg-secondary)"
              strokeWidth="2"
            />
          </g>
        )}
        
        {/* 起止点标记 */}
        {points.length > 0 && points[0] && points[points.length - 1] && (
          <>
            <circle
              cx={points[0].x}
              cy={points[0].y}
              r="3"
              fill="var(--text-tertiary)"
            />
            <circle
              cx={points[points.length - 1]!.x}
              cy={points[points.length - 1]!.y}
              r="4"
              fill={color}
              stroke="var(--bg-secondary)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      
      {/* 悬停提示框 */}
      {hoveredPoint && hoveredIndex !== null && (
        <div 
          className={styles.chartTooltip}
          style={{
            left: `${(hoveredPoint.x / chartWidth) * 100}%`,
            top: `${((hoveredPoint.y - 30) / chartHeight) * 100}%`,
          }}
        >
          <span className={styles.tooltipValue}>{formatValue(hoveredPoint.value)}</span>
          <span className={styles.tooltipIndex}>
            {timeRange === '1D' ? `${Math.floor((hoveredIndex / data.length) * 24)}:00` :
             timeRange === '7D' ? `Day ${Math.floor((hoveredIndex / data.length) * 7) + 1}` :
             `${Math.floor((hoveredIndex / data.length) * 30) + 1}d`}
          </span>
        </div>
      )}
      
      {/* 底部统计 */}
      <div className={styles.chartStats}>
        <div className={styles.chartStatItem}>
          <span className={styles.chartStatLabel}>Start</span>
          <span className={styles.chartStatValue}>{formatValue(startValue as number)}</span>
        </div>
        <div className={styles.chartStatItem}>
          <span className={styles.chartStatLabel}>Change</span>
          <span className={`${styles.chartStatValue} ${changeValue >= 0 ? styles.positive : styles.negative}`}>
            {changeValue >= 0 ? '+' : ''}{formatValue(changeValue)} ({changeValue >= 0 ? '+' : ''}{changePercent}%)
          </span>
        </div>
        <div className={styles.chartStatItem}>
          <span className={styles.chartStatLabel}>Current</span>
          <span className={styles.chartStatValue}>{formatValue(endValue as number)}</span>
        </div>
      </div>
    </div>
  );
}

// 市场卡片组件
function MarketCard({ 
  symbol, 
  name, 
  price, 
  change, 
  sparklineData,
  onClick 
}: { 
  symbol: string; 
  name: string; 
  price: string; 
  change: number;
  sparklineData: number[];
  onClick: () => void;
}) {
  const isPositive = change >= 0;
  
  return (
    <div className={styles.marketCard} onClick={onClick}>
      <div className={styles.marketHeader}>
        <div className={styles.marketIcon}>{symbol[0]}</div>
        <div className={styles.marketInfo}>
          <span className={styles.marketSymbol}>{symbol}</span>
          <span className={styles.marketName}>{name}</span>
        </div>
      </div>
      <div className={styles.marketBody}>
        <div className={styles.marketPrice}>${price}</div>
        <div className={`${styles.marketChange} ${isPositive ? styles.positive : styles.negative}`}>
          <Icon name={isPositive ? 'trending-up' : 'trending-down'} size="xs" />
          {formatPercent(change)}
        </div>
      </div>
      <div className={styles.marketChart}>
        <Sparkline 
          data={sparklineData} 
          width={100} 
          height={32}
          lineWidth={1.5}
        />
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({ 
  label, 
  value, 
  subValue, 
  icon, 
  color,
  onClick 
}: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  icon: IconName;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  onClick?: () => void;
}) {
  const colorMap = {
    blue: 'var(--color-info)',
    green: 'var(--color-success)',
    orange: 'var(--color-warning)',
    purple: '#8b5cf6',
    red: 'var(--color-error)',
  };
  
  return (
    <div 
      className={`${styles.statCard} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      style={{ '--stat-color': colorMap[color] } as React.CSSProperties}
    >
      <div className={styles.statIcon}>
        <Icon name={icon} size="sm" />
      </div>
      <div className={styles.statContent}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
        {subValue && <span className={styles.statSub}>{subValue}</span>}
      </div>
    </div>
  );
}

// 活动 Feed 项组件
function ActivityItem({ 
  type, 
  title, 
  description, 
  time, 
  value, 
  isPositive 
}: { 
  type: 'trade' | 'order' | 'trigger' | 'deposit';
  title: string;
  description: string;
  time: string;
  value?: string;
  isPositive?: boolean;
}) {
  const iconMap: Record<'trade' | 'order' | 'trigger' | 'deposit', IconName> = {
    trade: 'repeat',
    order: 'check-circle',
    trigger: 'zap',
    deposit: 'download',
  };
  
  const colorMap = {
    trade: styles.activityTrade,
    order: styles.activityOrder,
    trigger: styles.activityTrigger,
    deposit: styles.activityDeposit,
  };
  
  return (
    <div className={styles.activityItem}>
      <div className={`${styles.activityIcon} ${colorMap[type]}`}>
        <Icon name={iconMap[type]} size="xs" />
      </div>
      <div className={styles.activityContent}>
        <div className={styles.activityHeader}>
          <span className={styles.activityTitle}>{title}</span>
          <span className={styles.activityTime}>{time}</span>
        </div>
        <span className={styles.activityDesc}>{description}</span>
      </div>
      {value && (
        <span className={`${styles.activityValue} ${isPositive === true ? styles.positive : isPositive === false ? styles.negative : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}

export function AssetDetailPage() {
  const { t: _t } = useI18n();
  const navigate = useNavigate();
  
  // State
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Store data
  const balances = useWalletStore(selectBalances);
  const account = useWalletStore(selectAccount);
  const performanceMetrics = useWalletStore((state) => state.performanceMetrics);
  const ledger = useWalletStore((state) => state.ledger);
  const positions = useTradingStore((state) => state.positions);
  const orders = useTradingStore((state) => state.orders);
  const triggers = useAutomationStore((state) => state.triggers);
  const executionLogs = useAutomationStore((state) => state.executionLogs);
  const symbols = useWatchlistStore((state) => state.symbols);
  const setSelectedSymbol = useWatchlistStore((state) => state.setSelectedSymbol);

  // Helper to get position
  const getPosition = useCallback((symbol: string) => {
    if (!positions) return undefined;
    if (positions instanceof Map) return positions.get(symbol);
    if (typeof positions === 'object') return (positions as any)[symbol];
    return undefined;
  }, [positions]);

  // Processed asset list
  const assetList = useMemo(() => {
    if (!balances) return [];
    return balances.filter(b => new Decimal(b.total || 0).gt(0) || b.asset === 'USDT').map(balance => {
      const symbol = `${balance.asset}USDT`;
      const position = getPosition(symbol);
      const marketInfo = symbols?.find(s => s.symbol === symbol);
      
      const currentPrice = marketInfo?.price || '0';
      const avgPrice = position?.avgEntryPrice || '0';
      const priceChange24h = marketInfo?.change24h || 0;
      
      let unrealizedPnl = new Decimal(0);
      let unrealizedPnlPercent = new Decimal(0);
      
      if (new Decimal(avgPrice).gt(0) && new Decimal(currentPrice).gt(0)) {
        const qty = new Decimal(balance.total || 0);
        unrealizedPnl = qty.times(new Decimal(currentPrice).minus(avgPrice));
        unrealizedPnlPercent = new Decimal(currentPrice).minus(avgPrice).div(avgPrice).times(100);
      }

      const value = new Decimal(balance.total || 0).times(balance.asset === 'USDT' ? 1 : currentPrice);

      // Generate mock sparkline data based on price change
      const sparklineData = Array.from({ length: 24 }, (_, i) => {
        const base = parseFloat(currentPrice) || 100;
        const trend = parseFloat(String(priceChange24h)) > 0 ? 1 : -1;
        return base * (1 - (trend * 0.02 * (24 - i) / 24) + (Math.random() - 0.5) * 0.01);
      });

      return {
        ...balance,
        symbol,
        currentPrice,
        avgPrice,
        priceChange24h,
        unrealizedPnl: unrealizedPnl.toNumber(),
        unrealizedPnlPercent: unrealizedPnlPercent.toNumber(),
        value: value.toNumber(),
        sparklineData,
      };
    });
  }, [balances, getPosition, symbols]);

  // Filtered and sorted asset list
  const filteredAssets = useMemo(() => {
    let filtered = assetList.filter(a => 
      a.asset.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return filtered.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'value': aVal = a.value; bVal = b.value; break;
        case 'balance': aVal = parseFloat(a.total); bVal = parseFloat(b.total); break;
        case 'pnl': aVal = a.unrealizedPnl; bVal = b.unrealizedPnl; break;
        case 'pnlPercent': aVal = a.unrealizedPnlPercent; bVal = b.unrealizedPnlPercent; break;
        default: aVal = a.value; bVal = b.value;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [assetList, searchQuery, sortField, sortOrder]);

  // Portfolio totals with enhanced metrics
  const totals = useMemo(() => {
    const totalValue = assetList.reduce((acc, asset) => acc + asset.value, 0);
    const totalUnrealizedPnl = assetList.reduce((acc, asset) => acc + asset.unrealizedPnl, 0);
    
    // Calculate realized P&L from all positions
    let totalRealizedPnl = 0;
    if (positions instanceof Map) {
      positions.forEach((pos) => {
        if (pos && pos.realizedPnl) {
          totalRealizedPnl += parseFloat(pos.realizedPnl);
        }
      });
    } else if (typeof positions === 'object' && positions !== null) {
      Object.values(positions).forEach((pos: any) => {
        if (pos && pos.realizedPnl) {
          totalRealizedPnl += parseFloat(pos.realizedPnl);
        }
      });
    }
    
    // Total P&L (realized + unrealized)
    const totalPnl = totalRealizedPnl + totalUnrealizedPnl;
    
    // Available balance (USDT)
    const usdtBalance = balances?.find(b => b.asset === 'USDT');
    const availableBalance = parseFloat(usdtBalance?.available || '0');
    
    // Position value (total value minus USDT)
    const usdtValue = parseFloat(usdtBalance?.total || '0');
    const positionValue = totalValue - usdtValue;
    
    // Calculate initial capital from ledger (sum of all deposits)
    const initialCapital = ledger
      .filter(entry => entry.type === 'DEPOSIT' && entry.asset === 'USDT')
      .reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    // Fallback to 400000 if no deposits found (initial grant)
    const baseCapital = initialCapital > 0 ? initialCapital : 400000;
    const roi = baseCapital > 0 ? ((totalValue - baseCapital) / baseCapital) * 100 : 0;
    
    // P&L percentage
    const pnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
    
    // Calculate 24h change (weighted average)
    const totalChange24h = assetList.reduce((acc, asset) => {
      const weight = asset.value / (totalValue || 1);
      return acc + (parseFloat(String(asset.priceChange24h)) * weight);
    }, 0);
    
    return { 
      totalValue, 
      totalUnrealizedPnl,
      totalRealizedPnl,
      totalPnl, 
      pnlPercent, 
      totalChange24h,
      availableBalance,
      positionValue,
      roi,
    };
  }, [assetList, positions, balances]);

  // Portfolio history data (simulated)
  const portfolioHistoryData = useMemo(() => {
    const base = totals.totalValue;
    const points = timeRange === '1D' ? 24 : timeRange === '7D' ? 7 * 24 : timeRange === '30D' ? 30 : 90;
    const history: number[] = [];
    let current = base * 0.85;
    
    for (let i = 0; i < points; i++) {
      const change = (Math.random() - 0.45) * (base * 0.02);
      current += change;
      history.push(current);
    }
    history[points - 1] = base;
    return history;
  }, [totals.totalValue, timeRange]);

  // Trading stats
  const tradingStats = useMemo(() => {
    const filledOrders = orders.filter(o => o.status === 'filled');
    const openOrders = orders.filter(o => ['pending', 'open', 'partial'].includes(o.status));
    const activeTriggers = triggers.filter(t => t.enabled && t.status === 'armed');
    
    // Calculate position count
    let positionCount = 0;
    if (positions instanceof Map) {
      positions.forEach((pos) => {
        if (pos && parseFloat(pos.quantity) > 0) positionCount++;
      });
    }
    
    // Calculate 24h volume
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentTrades = orders
      .filter(o => o.fills.length > 0)
      .flatMap(o => o.fills)
      .filter(f => f.time > oneDayAgo);
    const volume24h = recentTrades.reduce((sum, f) => 
      sum + parseFloat(f.price) * parseFloat(f.quantity), 0);
    
    // Win rate calculation
    const tradesWithPnl = filledOrders.filter(o => {
      const pos = getPosition(o.symbol);
      return pos && parseFloat(pos.avgEntryPrice) > 0;
    });
    const winningTrades = tradesWithPnl.filter(o => {
      // Simplified: if buy and current price > order price, it's winning
      const marketInfo = symbols?.find(s => s.symbol === o.symbol);
      if (!marketInfo) return false;
      const currentPrice = parseFloat(marketInfo.price || '0');
      const orderPrice = parseFloat(o.avgPrice || o.price || '0');
      return o.side === 'buy' ? currentPrice > orderPrice : currentPrice < orderPrice;
    });
    const winRate = tradesWithPnl.length > 0 
      ? (winningTrades.length / tradesWithPnl.length) * 100 
      : 0;
    
    // Best performing asset
    const bestAsset = assetList
      .filter(a => a.unrealizedPnlPercent !== 0)
      .sort((a, b) => b.unrealizedPnlPercent - a.unrealizedPnlPercent)[0];
    
    return {
      positionCount,
      openOrderCount: openOrders.length,
      activeTriggerCount: activeTriggers.length,
      totalTrades: filledOrders.length,
      volume24h,
      winRate,
      bestAsset,
    };
  }, [orders, triggers, positions, assetList, getPosition, symbols]);

  // Recent activity
  const recentActivity = useMemo(() => {
    const activities: Array<{
      type: 'trade' | 'order' | 'trigger';
      title: string;
      description: string;
      time: number;
      value?: string;
      isPositive?: boolean;
    }> = [];
    
    // Recent filled orders
    orders
      .filter(o => o.status === 'filled')
      .slice(0, 5)
      .forEach(o => {
        const value = o.fills.reduce((sum, f) => 
          sum + parseFloat(f.price) * parseFloat(f.quantity), 0);
        activities.push({
          type: 'trade',
          title: `${o.side.toUpperCase()} ${o.symbol.replace('USDT', '')}`,
          description: `${parseFloat(o.filledQty).toFixed(6)} @ ${formatNumber(parseFloat(o.avgPrice || '0'))}`,
          time: o.updatedAt,
          value: formatNumber(value),
          isPositive: o.side === 'sell',
        });
      });
    
    // Recent trigger executions
    executionLogs
      .slice(0, 3)
      .forEach(log => {
        activities.push({
          type: 'trigger',
          title: `Trigger ${log.result === 'success' ? 'Executed' : 'Failed'}`,
          description: log.reason || 'Automation completed',
          time: log.timestamp || Date.now(),
        });
      });
    
    return activities
      .sort((a, b) => b.time - a.time)
      .slice(0, 6);
  }, [orders, executionLogs]);

  // Market data for BTC and ETH
  const marketData = useMemo(() => {
    const btc = symbols?.find(s => s.symbol === 'BTCUSDT');
    const eth = symbols?.find(s => s.symbol === 'ETHUSDT');
    
    return {
      btc: {
        price: btc?.price || '0',
        change: btc?.change24h || 0,
        sparkline: Array.from({ length: 24 }, () => 
          parseFloat(btc?.price || '95000') * (1 + (Math.random() - 0.5) * 0.02)),
      },
      eth: {
        price: eth?.price || '0',
        change: eth?.change24h || 0,
        sparkline: Array.from({ length: 24 }, () => 
          parseFloat(eth?.price || '3400') * (1 + (Math.random() - 0.5) * 0.02)),
      },
    };
  }, [symbols]);

  // Handlers
  const handleTrade = (asset: string) => {
    const symbol = `${asset}USDT`;
    setSelectedSymbol(symbol);
    navigate('/trade');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={styles.container}>
      {/* Hero Section - Portfolio Summary */}
      <section className={styles.heroSection}>
        <div className={styles.heroMain}>
          <div className={styles.portfolioHeader}>
            <div className={styles.portfolioLabel}>
              <Icon name="briefcase" size="sm" />
              <span>Portfolio Value</span>
            </div>
            <div className={styles.accountBadge}>
              <span>ID: {account?.accountId || 'PTT-DEMO'}</span>
              <span className={styles.simulatedTag}>Paper Trading</span>
            </div>
          </div>
          
          <div className={styles.portfolioValue}>
            <span className={styles.currency}>$</span>
            <span className={styles.amount}>{totals.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          <div className={styles.portfolioMeta}>
            <div className={`${styles.changeIndicator} ${totals.totalChange24h >= 0 ? styles.positive : styles.negative}`}>
              <Icon name={totals.totalChange24h >= 0 ? 'trending-up' : 'trending-down'} size="xs" />
              <span>{formatPercent(totals.totalChange24h)}</span>
              <span className={styles.changeLabel}>24h</span>
            </div>
            <div className={styles.pnlIndicator}>
              <span className={`${styles.pnlValue} ${totals.totalPnl >= 0 ? styles.positive : styles.negative}`}>
                {totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(2)}
              </span>
              <span className={styles.pnlLabel}>Total P&L</span>
            </div>
            <div className={styles.roiIndicator}>
              <span className={`${styles.roiValue} ${totals.roi >= 0 ? styles.positive : styles.negative}`}>
                {totals.roi >= 0 ? '+' : ''}{totals.roi.toFixed(2)}%
              </span>
              <span className={styles.roiLabel}>ROI</span>
            </div>
          </div>
          
          {/* Enhanced Metrics Grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="wallet" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>${totals.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={styles.metricLabel}>Available Balance</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="layers" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>${totals.positionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={styles.metricLabel}>Position Value</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="check-circle" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={`${styles.metricValue} ${totals.totalRealizedPnl >= 0 ? styles.positive : styles.negative}`}>
                  {totals.totalRealizedPnl >= 0 ? '+' : ''}${totals.totalRealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={styles.metricLabel}>Realized P&L</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="activity" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={`${styles.metricValue} ${totals.totalUnrealizedPnl >= 0 ? styles.positive : styles.negative}`}>
                  {totals.totalUnrealizedPnl >= 0 ? '+' : ''}${totals.totalUnrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={styles.metricLabel}>Unrealized P&L</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="target" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>{tradingStats.winRate.toFixed(1)}%</span>
                <span className={styles.metricLabel}>Win Rate</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="bar-chart-2" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>{performanceMetrics.profitFactor.toFixed(2)}</span>
                <span className={styles.metricLabel}>Profit Factor</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="trending-down" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={`${styles.metricValue} ${performanceMetrics.maxDrawdown > 0 ? styles.negative : ''}`}>
                  {performanceMetrics.maxDrawdown.toFixed(2)}%
                </span>
                <span className={styles.metricLabel}>Max Drawdown</span>
              </div>
            </div>
            
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>
                <Icon name="repeat" size="xs" />
              </div>
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>{tradingStats.totalTrades}</span>
                <span className={styles.metricLabel}>Total Trades</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.heroChart}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Portfolio Growth</span>
            <div className={styles.timeRangeSelector}>
              {(['1D', '7D', '30D', 'ALL'] as TimeRange[]).map(range => (
                <button
                  key={range}
                  className={`${styles.timeRangeBtn} ${timeRange === range ? styles.active : ''}`}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.chartContainer}>
            <PortfolioChart 
              data={portfolioHistoryData} 
              color={totals.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-error)'}
              height={120}
              timeRange={timeRange}
            />
          </div>
        </div>
        
        <div className={styles.heroActions}>
          <button className={styles.primaryAction} onClick={() => navigate('/wallet')}>
            <Icon name="download" size="sm" />
            <span>Deposit</span>
          </button>
          <button className={styles.secondaryAction} onClick={() => navigate('/trade')}>
            <Icon name="activity" size="sm" />
            <span>Trade</span>
          </button>
          <button className={styles.tertiaryAction} onClick={() => navigate('/orders')}>
            <Icon name="layers" size="sm" />
            <span>Orders</span>
          </button>
        </div>
      </section>

      {/* Market Overview */}
      <section className={styles.marketSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Market Overview</h2>
          <button className={styles.viewAllBtn} onClick={() => navigate('/markets')}>
            View All Markets
            <Icon name="chevron-right" size="xs" />
          </button>
        </div>
        <div className={styles.marketCards}>
          <MarketCard
            symbol="BTC"
            name="Bitcoin"
            price={parseFloat(marketData.btc.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            change={parseFloat(String(marketData.btc.change))}
            sparklineData={marketData.btc.sparkline}
            onClick={() => handleTrade('BTC')}
          />
          <MarketCard
            symbol="ETH"
            name="Ethereum"
            price={parseFloat(marketData.eth.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            change={parseFloat(String(marketData.eth.change))}
            sparklineData={marketData.eth.sparkline}
            onClick={() => handleTrade('ETH')}
          />
        </div>
      </section>

      {/* Quick Stats */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <StatCard
            label="Open Positions"
            value={tradingStats.positionCount}
            icon="briefcase"
            color="blue"
            onClick={() => navigate('/trade')}
          />
          <StatCard
            label="Open Orders"
            value={tradingStats.openOrderCount}
            icon="list"
            color="orange"
            onClick={() => navigate('/orders')}
          />
          <StatCard
            label="Active Triggers"
            value={tradingStats.activeTriggerCount}
            icon="zap"
            color="purple"
            onClick={() => navigate('/orders')}
          />
          <StatCard
            label="24h Volume"
            value={formatNumber(tradingStats.volume24h)}
            icon="bar-chart-2"
            color="green"
          />
          <StatCard
            label="Total Trades"
            value={tradingStats.totalTrades}
            icon="repeat"
            color="blue"
          />
          <StatCard
            label="Win Rate"
            value={`${tradingStats.winRate.toFixed(0)}%`}
            subValue={tradingStats.winRate >= 50 ? 'Above average' : 'Below average'}
            icon="target"
            color={tradingStats.winRate >= 50 ? 'green' : 'red'}
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className={styles.mainGrid}>
        {/* Asset Holdings */}
        <section className={styles.assetsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Icon name="wallet" size="sm" />
              Asset Holdings
            </h2>
            <div className={styles.tableControls}>
              <div className={styles.searchBox}>
                <Icon name="search" size="xs" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.assetTable}>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className={styles.sortable} onClick={() => handleSort('balance')}>
                    Balance
                    {sortField === 'balance' && <Icon name={sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'} size="xs" />}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('value')}>
                    Value
                    {sortField === 'value' && <Icon name={sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'} size="xs" />}
                  </th>
                  <th>Price</th>
                  <th className={styles.sortable} onClick={() => handleSort('pnl')}>
                    P&L
                    {sortField === 'pnl' && <Icon name={sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'} size="xs" />}
                  </th>
                  <th>24h</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => {
                  const allocation = totals.totalValue > 0 
                    ? (asset.value / totals.totalValue) * 100 
                    : 0;
                  
                  return (
                    <tr key={asset.asset}>
                      <td>
                        <div className={styles.assetCell}>
                          <div className={styles.assetIcon}>{asset.asset[0]}</div>
                          <div className={styles.assetInfo}>
                            <span className={styles.assetSymbol}>{asset.asset}</span>
                            <span className={styles.assetAlloc}>{allocation.toFixed(1)}% of portfolio</span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.numericCell}>
                        <span className={styles.balanceValue}>{parseFloat(asset.total).toFixed(asset.asset === 'USDT' ? 2 : 6)}</span>
                      </td>
                      <td className={styles.numericCell}>
                        <span className={styles.valueAmount}>${asset.value.toFixed(2)}</span>
                      </td>
                      <td className={styles.numericCell}>
                        {asset.asset !== 'USDT' ? (
                          <span className={styles.priceValue}>${parseFloat(asset.currentPrice).toFixed(2)}</span>
                        ) : '—'}
                      </td>
                      <td className={styles.numericCell}>
                        {asset.unrealizedPnl !== 0 ? (
                          <div className={`${styles.pnlCell} ${asset.unrealizedPnl >= 0 ? styles.positive : styles.negative}`}>
                            <span>{asset.unrealizedPnl >= 0 ? '+' : ''}${asset.unrealizedPnl.toFixed(2)}</span>
                            <span className={styles.pnlPercent}>{formatPercent(asset.unrealizedPnlPercent)}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {asset.asset !== 'USDT' && (
                          <div className={styles.sparklineCell}>
                            <Sparkline data={asset.sparklineData} width={60} height={24} lineWidth={1} />
                          </div>
                        )}
                      </td>
                      <td>
                        {asset.asset !== 'USDT' && (
                          <button 
                            className={styles.tradeBtn}
                            onClick={() => handleTrade(asset.asset)}
                          >
                            Trade
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Side Panel */}
        <aside className={styles.sidePanel}>
          {/* Allocation Chart */}
          <div className={styles.allocationCard}>
            <h3 className={styles.cardTitle}>Portfolio Allocation</h3>
            <div className={styles.allocationList}>
              {filteredAssets.slice(0, 5).map((asset, i) => {
                const ratio = totals.totalValue > 0 
                  ? (asset.value / totals.totalValue) * 100 
                  : 0;
                const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444'];
                return (
                  <div key={asset.asset} className={styles.allocItem}>
                    <div className={styles.allocHeader}>
                      <span className={styles.allocBullet} style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className={styles.allocSymbol}>{asset.asset}</span>
                      <span className={styles.allocPercent}>{ratio.toFixed(1)}%</span>
                    </div>
                    <div className={styles.allocBar}>
                      <div 
                        className={styles.allocBarFill}
                        style={{ width: `${ratio}%`, backgroundColor: colors[i % colors.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className={styles.activityCard}>
            <div className={styles.activityHeader}>
              <h3 className={styles.cardTitle}>Recent Activity</h3>
              <button className={styles.viewAllBtn} onClick={() => navigate('/orders')}>
                View All
                <Icon name="chevron-right" size="xs" />
              </button>
            </div>
            <div className={styles.activityList}>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, i) => (
                  <ActivityItem
                    key={i}
                    type={activity.type}
                    title={activity.title}
                    description={activity.description}
                    time={formatTimeAgo(activity.time)}
                    value={activity.value}
                    isPositive={activity.isPositive}
                  />
                ))
              ) : (
                <div className={styles.emptyActivity}>
                  <Icon name="clock" size="lg" />
                  <p>No recent activity</p>
                  <button onClick={() => navigate('/trade')}>Start Trading</button>
                </div>
              )}
            </div>
          </div>

          {/* Best Performer */}
          {tradingStats.bestAsset && (
            <div className={styles.performerCard}>
              <h3 className={styles.cardTitle}>Top Performer</h3>
              <div className={styles.performerContent}>
                <div className={styles.performerIcon}>{tradingStats.bestAsset.asset[0]}</div>
                <div className={styles.performerInfo}>
                  <span className={styles.performerSymbol}>{tradingStats.bestAsset.asset}</span>
                  <span className={`${styles.performerPnl} ${tradingStats.bestAsset.unrealizedPnlPercent >= 0 ? styles.positive : styles.negative}`}>
                    {formatPercent(tradingStats.bestAsset.unrealizedPnlPercent)}
                  </span>
                </div>
                <button 
                  className={styles.performerTradeBtn}
                  onClick={() => handleTrade(tradingStats.bestAsset!.asset)}
                >
                  Trade
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
