import { useState } from 'react';
import Decimal from 'decimal.js';
import { useTradingStore } from '../../store/tradingStore';
import { useWalletStore, selectBalances } from '../../store/walletStore';
import { useMarketStore, selectMetrics, selectOrderBook } from '../../store/marketStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';

// Helper to get price from watchlist
const selectSymbolPrices = (state: { symbols: Array<{ symbol: string; price?: string }> }) => {
  const priceMap = new Map<string, string>();
  state.symbols.forEach(s => {
    if (s.price) priceMap.set(s.symbol, s.price);
  });
  return priceMap;
};
import { useI18n } from '../../i18n';
import { toast } from '../Toast';
import { Icon } from '../Icon';
import { TPSLForm } from './TPSLForm';
import styles from './Positions.module.css';

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
          <Icon name="alert-triangle" size="sm" className={styles[type]} />
          <h3 className={styles.modalTitle}>{title}</h3>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
          {detail && <p className={styles.modalDetail}>{detail}</p>}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>{cancelText}</button>
          <button className={`${styles.confirmBtn} ${styles[type]}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function formatUSDT(value: string | number): string {
  return new Decimal(value).toFixed(2);
}

function formatCrypto(value: string | number): string {
  return new Decimal(value).toFixed(6).replace(/\.?0+$/, '') || '0';
}

export function Positions() {
  const { t } = useI18n();
  const balances = useWalletStore(selectBalances);
  const positions = useTradingStore((state) => state.positions);
  const createOrder = useTradingStore((state) => state.createOrder);
  const metrics = useMarketStore(selectMetrics);
  const orderBook = useMarketStore(selectOrderBook);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const setSelectedSymbol = useWatchlistStore((state) => state.setSelectedSymbol);
  const symbolPrices = useWatchlistStore(selectSymbolPrices);
  const resetAccount = useTradingStore((state) => state.resetAccount);

  const [closeConfirm, setCloseConfirm] = useState<{
    isOpen: boolean;
    symbol: string;
    quantity: string;
    value: number;
  } | null>(null);

  const [tpslTarget, setTpslTarget] = useState<{
    symbol: string;
    currentPrice: number;
    avgEntryPrice: number;
    quantity: string;
  } | null>(null);

  const currentSymbolMidPrice = metrics ? new Decimal(metrics.mid) : new Decimal(0);
  const currentSymbol = orderBook?.symbol || selectedSymbol;
  
  const usdtBalance = balances.find(b => b.asset === 'USDT');
  const usdtTotal = new Decimal(usdtBalance?.total ?? '0');

  let positionEntries: [string, any][] = [];
  if (positions instanceof Map) {
    positionEntries = Array.from(positions.entries());
  } else if (typeof positions === 'object' && positions !== null) {
    positionEntries = Object.entries(positions);
  }
  
  let totalPositionValue = new Decimal(0);
  let totalUnrealizedPnl = new Decimal(0);

  const positionsWithPnl = positionEntries
    .filter(([_, pos]) => pos && pos.quantity !== undefined && pos.avgEntryPrice !== undefined && pos.side === 'long' && new Decimal(pos.quantity).gt(0))
    .map(([symbol, pos]) => {
      const qty = new Decimal(pos.quantity || '0');
      const avgEntry = new Decimal(pos.avgEntryPrice || '0');
      const isCurrentSymbol = symbol === currentSymbol;
      
      // 优先使用当前选中币种的实时价格，否则使用 watchlist 中的价格
      let currentPrice: Decimal;
      let hasRealTimePrice = false;
      
      if (isCurrentSymbol && currentSymbolMidPrice.gt(0)) {
        currentPrice = currentSymbolMidPrice;
        hasRealTimePrice = true;
      } else {
        const watchlistPrice = symbolPrices.get(symbol);
        if (watchlistPrice) {
          currentPrice = new Decimal(watchlistPrice);
          hasRealTimePrice = true;
        } else {
          currentPrice = avgEntry;
        }
      }
      
      const value = qty.times(currentPrice);
      const unrealizedPnl = hasRealTimePrice ? qty.times(currentPrice.minus(avgEntry)) : new Decimal(0);
      const pnlPercent = hasRealTimePrice && avgEntry.gt(0) ? currentPrice.minus(avgEntry).div(avgEntry).times(100) : new Decimal(0);

      totalPositionValue = totalPositionValue.plus(value);
      if (hasRealTimePrice) {
        totalUnrealizedPnl = totalUnrealizedPnl.plus(unrealizedPnl);
      }

      return {
        ...pos, symbol,
        currentPrice: currentPrice.toNumber(),
        value: value.toNumber(),
        unrealizedPnl: unrealizedPnl.toNumber(),
        pnlPercent: pnlPercent.toNumber(),
        hasRealTimePrice,
      };
    });

  const totalAccountValue = usdtTotal.plus(totalPositionValue);
  const accountPnlPercent = totalUnrealizedPnl.div(totalAccountValue.gt(0) ? totalAccountValue : 1).times(100).toNumber();

  const handleReset = () => {
    resetAccount();
    toast.info(t.common.reset);
  };

  const handleClosePositionClick = (symbol: string, quantity: string, value: number) => {
    setCloseConfirm({ isOpen: true, symbol, quantity, value });
  };

  const confirmClosePosition = () => {
    if (!closeConfirm) return;
    const { symbol, quantity } = closeConfirm;
    
    if (currentSymbol !== symbol) {
      setSelectedSymbol(symbol);
      toast.info(t.positions?.switchingSymbol || `Switching to ${symbol}...`);
      setTimeout(() => {
        const currentMetrics = useMarketStore.getState().metrics;
        if (currentMetrics) {
          const order = createOrder({ symbol, side: 'sell', type: 'market', quantity }, currentMetrics.mid);
          if (order) toast.success(t.positions?.closeOrderSubmitted || 'Close order submitted');
          else toast.error(t.orderEntry?.insufficientBalance || 'Insufficient balance');
        }
      }, 2000);
    } else {
      if (metrics) {
        const order = createOrder({ symbol, side: 'sell', type: 'market', quantity }, metrics.mid);
        if (order) toast.success(t.positions?.closeOrderSubmitted || 'Close order submitted');
        else toast.error(t.orderEntry?.insufficientBalance || 'Insufficient balance');
      } else {
        toast.error(t.positions?.noMarketData || 'No market data');
      }
    }
    setCloseConfirm(null);
  };

  const activeBalances = balances.filter(b => new Decimal(b.total).gt(0) || b.asset === 'USDT');

  return (
    <div className={styles.container}>
      {/* Compact Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>{t.account.title}</span>
          <div className={styles.headerStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total</span>
              <span className={styles.statValue}>${formatUSDT(totalAccountValue.toString())}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>PnL</span>
              <span className={`${styles.statValue} ${accountPnlPercent >= 0 ? 'price-up' : 'price-down'}`}>
                {accountPnlPercent >= 0 ? '+' : ''}{accountPnlPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <button className={styles.resetBtn} onClick={handleReset}>{t.common.reset}</button>
      </div>
      
      <div className={styles.body}>
        {/* Positions Table */}
        {positionsWithPnl.length > 0 ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Symbol</th>
                  <th>Size</th>
                  <th>Entry</th>
                  <th>Mark</th>
                  <th>PnL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {positionsWithPnl.map((pos) => (
                  <tr key={pos.symbol}>
                    <td>
                      <div className={styles.symbolCell}>
                        <span className={styles.symbol}>{pos.symbol.replace('USDT', '')}</span>
                        <span className={`${styles.sideBadge} ${styles.long}`}>L</span>
                      </div>
                    </td>
                    <td className={styles.numericCell}>{formatCrypto(pos.quantity)}</td>
                    <td className={styles.numericCell}>${formatUSDT(pos.avgEntryPrice)}</td>
                    <td className={styles.numericCell}>
                      {pos.hasRealTimePrice ? `$${formatUSDT(pos.currentPrice)}` : '—'}
                    </td>
                    <td className={`${styles.pnlCell} ${pos.hasRealTimePrice ? (pos.unrealizedPnl >= 0 ? styles.positive : styles.negative) : styles.pending}`}>
                      {pos.hasRealTimePrice ? (
                        <>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                          <span style={{ opacity: 0.7, marginLeft: 4, fontSize: 9 }}>
                            ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)
                          </span>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => setTpslTarget({
                            symbol: pos.symbol,
                            currentPrice: pos.currentPrice,
                            avgEntryPrice: parseFloat(pos.avgEntryPrice),
                            quantity: pos.quantity
                          })}
                        >
                          <Icon name="target" size="xs" />
                          TP/SL
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.closeBtn}`}
                          onClick={() => handleClosePositionClick(pos.symbol, pos.quantity, pos.value)}
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>No open positions</div>
        )}
      </div>

      {/* Balance Footer */}
      <div className={styles.balanceRow}>
        {activeBalances.map((balance) => (
          <div key={balance.asset} className={styles.balanceItem}>
            <span className={styles.balanceAsset}>{balance.asset}</span>
            <span className={styles.balanceValue}>
              {balance.asset === 'USDT' ? formatUSDT(balance.total) : formatCrypto(balance.total)}
            </span>
            {new Decimal(balance.frozen).gt(0) && (
              <span className={styles.balanceLocked}>
                ({balance.asset === 'USDT' ? formatUSDT(balance.frozen) : formatCrypto(balance.frozen)} locked)
              </span>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!closeConfirm?.isOpen}
        title={t.positions?.confirmCloseTitle || 'Confirm Close'}
        message={t.positions?.confirmCloseMessage || `Close all ${closeConfirm?.symbol?.replace('USDT', '')} at market price?`}
        detail={closeConfirm ? `${formatCrypto(closeConfirm.quantity)} ${closeConfirm.symbol.replace('USDT', '')} ≈ $${closeConfirm.value.toFixed(2)}` : undefined}
        confirmText={t.positions?.confirmClose || 'Close Position'}
        cancelText={t.common?.cancel || 'Cancel'}
        onConfirm={confirmClosePosition}
        onCancel={() => setCloseConfirm(null)}
        type="danger"
      />

      {tpslTarget && (
        <div className={styles.tpslModalOverlay} onClick={() => setTpslTarget(null)}>
          <div className={styles.tpslModalContent} onClick={e => e.stopPropagation()}>
            <TPSLForm
              symbol={tpslTarget.symbol}
              currentPrice={tpslTarget.currentPrice}
              avgEntryPrice={tpslTarget.avgEntryPrice}
              quantity={tpslTarget.quantity}
              onClose={() => setTpslTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
