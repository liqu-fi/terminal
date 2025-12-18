import { useState } from 'react';
import Decimal from 'decimal.js';
import { useTradingStore, selectBalances } from '../../store/tradingStore';
import { useMarketStore, selectMetrics, selectOrderBook } from '../../store/marketStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { toast } from '../Toast';
import { Icon } from '../Icon';
import styles from './Positions.module.css';

// 确认弹窗组件
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning';
}

function ConfirmModal({ isOpen, title, message, detail, confirmText, cancelText, onConfirm, onCancel, type = 'danger' }: ConfirmModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <Icon name="alert-triangle" size="md" className={styles[type]} />
          <h3 className={styles.modalTitle}>{title}</h3>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
          {detail && <p className={styles.modalDetail}>{detail}</p>}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`${styles.confirmBtn} ${styles[type]}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// 格式化金额显示（避免浮点数精度问题）
function formatUSDT(value: string | number): string {
  const d = new Decimal(value);
  return d.toFixed(2);
}

function formatCrypto(value: string | number): string {
  const d = new Decimal(value);
  // 去掉尾部多余的零
  return d.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function Positions() {
  const { t } = useI18n();
  const balances = useTradingStore(selectBalances);
  const positions = useTradingStore((state) => state.positions);
  const createOrder = useTradingStore((state) => state.createOrder);
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const setSelectedSymbol = useWatchlistStore((state) => state.setSelectedSymbol);
  const resetAccount = useTradingStore((state) => state.resetAccount);

  // 平仓确认状态
  const [closeConfirm, setCloseConfirm] = useState<{
    isOpen: boolean;
    symbol: string;
    quantity: string;
    value: number;
  } | null>(null);

  // 当前选中币种的 mid 价格
  const currentSymbolMidPrice = metrics ? new Decimal(metrics.mid) : new Decimal(0);
  const currentSymbol = orderBook?.symbol || selectedSymbol;
  
  // Get USDT balance（使用 Decimal 避免精度问题）
  const usdtBalance = balances.find(b => b.asset === 'USDT');
  const usdtTotal = new Decimal(usdtBalance?.total ?? '0');

  // Calculate position values
  // 注意：只有当前选中币种的持仓才能计算实时盈亏
  // 其他币种的持仓使用入场价作为参考（因为没有实时价格）
  const positionEntries = Array.from(positions.entries());
  let totalPositionValue = new Decimal(0);
  let totalUnrealizedPnl = new Decimal(0);

  const positionsWithPnl = positionEntries
    .filter(([_, pos]) => pos.side === 'long' && new Decimal(pos.quantity).gt(0))
    .map(([symbol, pos]) => {
      const qty = new Decimal(pos.quantity);
      const avgEntry = new Decimal(pos.avgEntryPrice);
      
      // 只有当前选中的币种才使用实时价格计算盈亏
      const isCurrentSymbol = symbol === currentSymbol;
      const currentPrice = isCurrentSymbol ? currentSymbolMidPrice : avgEntry;
      const hasRealTimePrice = isCurrentSymbol && currentSymbolMidPrice.gt(0);
      
      const value = qty.times(currentPrice);
      const unrealizedPnl = hasRealTimePrice ? qty.times(currentPrice.minus(avgEntry)) : new Decimal(0);
      const pnlPercent = hasRealTimePrice && avgEntry.gt(0) 
        ? currentPrice.minus(avgEntry).div(avgEntry).times(100) 
        : new Decimal(0);

      // 只有有实时价格的持仓才计入总盈亏
      if (hasRealTimePrice) {
        totalPositionValue = totalPositionValue.plus(value);
        totalUnrealizedPnl = totalUnrealizedPnl.plus(unrealizedPnl);
      } else {
        // 没有实时价格的持仓，使用入场价估算价值
        totalPositionValue = totalPositionValue.plus(qty.times(avgEntry));
      }

      return {
        symbol,
        ...pos,
        currentPrice: currentPrice.toNumber(),
        value: value.toNumber(),
        unrealizedPnl: unrealizedPnl.toNumber(),
        pnlPercent: pnlPercent.toNumber(),
        hasRealTimePrice,
      };
    });

  const totalAccountValue = usdtTotal.plus(totalPositionValue);
  const initialValue = new Decimal(100000);
  const accountPnlPercent = initialValue.gt(0) 
    ? totalAccountValue.minus(initialValue).div(initialValue).times(100).toNumber()
    : 0;

  const handleReset = () => {
    resetAccount();
    toast.info(t.common.reset);
  };

  // 显示平仓确认弹窗
  const handleClosePositionClick = (symbol: string, quantity: string, value: number) => {
    setCloseConfirm({ isOpen: true, symbol, quantity, value });
  };

  // 确认平仓
  const confirmClosePosition = () => {
    if (!closeConfirm) return;
    
    const { symbol, quantity } = closeConfirm;
    
    // 如果当前不是这个币种，先切换
    if (currentSymbol !== symbol) {
      setSelectedSymbol(symbol);
      toast.info(t.positions?.switchingSymbol || `切换到 ${symbol}...`);
      // 延迟执行，等待市场数据加载
      setTimeout(() => {
        const currentMetrics = useMarketStore.getState().metrics;
        if (currentMetrics) {
          const order = createOrder({
            symbol,
            side: 'sell',
            type: 'market',
            quantity,
          }, currentMetrics.mid);
          
          if (order) {
            toast.success(t.positions?.closeOrderSubmitted || '平仓订单已提交');
          } else {
            toast.error(t.orderEntry?.insufficientBalance || '余额不足');
          }
        }
      }, 2000);
    } else {
      // 当前币种，直接平仓
      if (metrics) {
        const order = createOrder({
          symbol,
          side: 'sell',
          type: 'market',
          quantity,
        }, metrics.mid);
        
        if (order) {
          toast.success(t.positions?.closeOrderSubmitted || '平仓订单已提交');
        } else {
          toast.error(t.orderEntry?.insufficientBalance || '余额不足');
        }
      } else {
        toast.error(t.positions?.noMarketData || '无市场数据，请稍后重试');
      }
    }
    
    setCloseConfirm(null);
  };

  return (
    <div className={`card ${styles.container}`}>
      <div className={`card-header ${styles.header}`}>
        <span>{t.account.title}</span>
        <button className={styles.resetBtn} onClick={handleReset}>
          {t.common.reset}
        </button>
      </div>
      
      <div className={styles.body}>
        {/* Account Summary */}
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t.account.totalValue}</span>
            <span className={`${styles.summaryValue} tabular-nums`}>
              ${formatUSDT(totalAccountValue.toString())}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t.positions.unrealizedPnL}</span>
            <span className={`${styles.summaryValue} tabular-nums ${accountPnlPercent >= 0 ? 'price-up' : 'price-down'}`}>
              {accountPnlPercent >= 0 ? '+' : ''}{accountPnlPercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Balances */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t.account.balance}</div>
          <div className={styles.balanceList}>
            {balances
              .filter(b => new Decimal(b.total).gt(0) || b.asset === 'USDT')
              .map((balance) => (
                <div key={balance.asset} className={styles.balanceRow}>
                  <span className={styles.asset}>{balance.asset}</span>
                  <div className={styles.balanceValues}>
                    <span className={`${styles.balanceTotal} tabular-nums`}>
                      {balance.asset === 'USDT' ? formatUSDT(balance.total) : formatCrypto(balance.total)}
                    </span>
                    {new Decimal(balance.locked).gt(0) && (
                      <span className={`${styles.balanceLocked} tabular-nums`}>
                        ({balance.asset === 'USDT' ? formatUSDT(balance.locked) : formatCrypto(balance.locked)} {t.account.locked})
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Positions */}
        {positionsWithPnl.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.positions.title}</div>
            <div className={styles.positionList}>
              {positionsWithPnl.map((pos) => (
                <div key={pos.symbol} className={styles.positionRow}>
                  <div className={styles.positionMain}>
                    <div className={styles.positionInfo}>
                      <span className={styles.positionSymbol}>{pos.symbol}</span>
                      <span className={`${styles.positionSide} ${styles.long}`}>{t.positions.long}</span>
                    </div>
                    <button 
                      className={styles.closePositionBtn}
                      onClick={() => handleClosePositionClick(pos.symbol, pos.quantity, pos.value)}
                      title={t.positions?.closePosition || '市价全平'}
                    >
                      <Icon name="log-out" size="sm" />
                      {t.positions?.marketClose || '市价全平'}
                    </button>
                  </div>
                  <div className={styles.positionDetails}>
                    <div className={styles.positionDetail}>
                      <span className={styles.detailLabel}>{t.positions.amount}</span>
                      <span className={`${styles.detailValue} tabular-nums`}>
                        {formatCrypto(pos.quantity)}
                      </span>
                    </div>
                    <div className={styles.positionDetail}>
                      <span className={styles.detailLabel}>{t.positions.avgPrice}</span>
                      <span className={`${styles.detailValue} tabular-nums`}>
                        ${formatUSDT(pos.avgEntryPrice)}
                      </span>
                    </div>
                    <div className={styles.positionDetail}>
                      <span className={styles.detailLabel}>{t.positions.unrealizedPnL}</span>
                      {pos.hasRealTimePrice ? (
                        <span className={`${styles.detailValue} tabular-nums ${pos.unrealizedPnl >= 0 ? 'price-up' : 'price-down'}`}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                          <span className={styles.pnlPercent}>
                            ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                          </span>
                        </span>
                      ) : (
                        <span className={`${styles.detailValue} tabular-nums ${styles.pendingPrice}`}>
                          --
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 平仓确认弹窗 */}
      <ConfirmModal
        isOpen={!!closeConfirm?.isOpen}
        title={t.positions?.confirmCloseTitle || '确认平仓'}
        message={t.positions?.confirmCloseMessage || `确定要市价卖出全部 ${closeConfirm?.symbol?.replace('USDT', '')} 吗？`}
        detail={closeConfirm ? `${formatCrypto(closeConfirm.quantity)} ${closeConfirm.symbol.replace('USDT', '')} ≈ $${closeConfirm.value.toFixed(2)}` : undefined}
        confirmText={t.positions?.confirmClose || '确认平仓'}
        cancelText={t.common?.cancel || '取消'}
        onConfirm={confirmClosePosition}
        onCancel={() => setCloseConfirm(null)}
        type="danger"
      />
    </div>
  );
}
