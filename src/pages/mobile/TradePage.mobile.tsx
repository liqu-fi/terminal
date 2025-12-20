import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { OrderBook } from '../../components/OrderBook';
import { RecentTrades } from '../../components/RecentTrades';
import { PriceChart } from '../../components/Chart';
import { Watchlist } from '../../components/Watchlist';
import { DepthChart } from '../../components/DepthChart';
import { RiskRibbon } from '../../components/RiskRibbon';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Icon } from '../../components/Icon';
import { MobileDrawer, MobileSegmentedControl, TradeOverview } from '../../components/mobile';
import { MobileOrderEntry } from './MobileOrderEntry';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useMarketStore, selectOrderBook, selectMetrics } from '../../store/marketStore';
import { formatVolume, formatPrice } from '../../services/marketDataService';
import { useTradingStore } from '../../store/tradingStore';
import { useWalletStore } from '../../store/walletStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import styles from './TradePage.mobile.module.css';

type ContentTab = 'overview' | 'trade' | 'chart' | 'depth' | 'orderbook' | 'trades';

const PanelFallback = ({ name }: { name: string }) => (
  <div className={styles.fallback}>
    <Icon name="alert-circle" size="sm" />
    <span>{name} Error</span>
  </div>
);

export function MobileTradePage() {
  const { t } = useI18n();
  const { trigger } = useHapticFeedback();
  const orderBook = useMarketStore(selectOrderBook);
  const metrics = useMarketStore(selectMetrics);
  const subscribe = useMarketStore((state) => state.subscribe);
  const unsubscribe = useMarketStore((state) => state.unsubscribe);
  const updateOrderBookForMatching = useTradingStore((state) => state.updateOrderBookForMatching);
  const positions = useTradingStore((state) => state.positions);
  const balances = useWalletStore((state) => state.balances);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);

  const [activeTab, setActiveTab] = useState<ContentTab>('trade');
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [selectedPrice, setSelectedPrice] = useState<string | undefined>();
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);
  const [prevPrice, setPrevPrice] = useState<string | null>(null);
  const [priceFlash, setPriceFlash] = useState(false);

  // Price change effect
  useEffect(() => {
    if (metrics?.mid && metrics.mid !== prevPrice) {
      setPrevPrice(metrics.mid);
      setPriceFlash(true);
      const timer = setTimeout(() => setPriceFlash(false), 200);
      return () => clearTimeout(timer);
    }
  }, [metrics?.mid, prevPrice]);

  // Touch handling for swipe navigation
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const tabs: ContentTab[] = ['overview', 'trade', 'chart', 'depth', 'orderbook', 'trades'];

  const handlePriceClick = useCallback((price: string, side?: 'buy' | 'sell') => {
    setSelectedPrice(price);
    if (side) setOrderSide(side);
    setIsOrderDrawerOpen(true);
  }, []);

  const handleSymbolChange = useCallback((_symbol: string) => {
    setSelectedPrice(undefined);
    setShowSymbolSelector(false);
  }, []);

  const handleOpenOrder = (side: 'buy' | 'sell') => {
    setOrderSide(side);
    setIsOrderDrawerOpen(true);
  };

  // Get current position and account info
  const baseAsset = selectedSymbol.replace('USDT', '');
  const currentPosition = positions.get(selectedSymbol);
  
  // Calculate total account value in USDT
  const accountInfo = useMemo(() => {
    const currentPrice = metrics?.mid ? parseFloat(metrics.mid) : 0;
    const usdtBal = balances.find(b => b.asset === 'USDT');
    const baseBal = balances.find(b => b.asset === baseAsset);
    
    const usdtValue = usdtBal ? parseFloat(usdtBal.total) : 0;
    const usdtAvailable = usdtBal ? parseFloat(usdtBal.available) : 0;
    const baseQty = baseBal ? parseFloat(baseBal.total) : 0;
    const baseValueInUsdt = baseQty * currentPrice;
    
    // Total equity = USDT + (base asset * current price)
    const totalEquity = usdtValue + baseValueInUsdt;
    
    return {
      totalEquity,
      usdtAvailable,
      baseQty,
      baseValueInUsdt,
      currentPrice,
    };
  }, [balances, baseAsset, metrics?.mid]);

  // Subscribe to market data
  useEffect(() => {
    subscribe(selectedSymbol);
    return () => unsubscribe();
  }, [selectedSymbol, subscribe, unsubscribe]);

  // Update orderbook for matching engine
  useEffect(() => {
    if (orderBook) {
      updateOrderBookForMatching(orderBook);
    }
  }, [orderBook, updateOrderBookForMatching]);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0]) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        const currentIndex = tabs.indexOf(activeTab);
        if (deltaX < 0 && currentIndex < tabs.length - 1) {
          // Swipe left - next tab
          const nextTab = tabs[currentIndex + 1];
          if (nextTab) {
            setActiveTab(nextTab);
            trigger('selection');
          }
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - previous tab
          const prevTab = tabs[currentIndex - 1];
          if (prevTab) {
            setActiveTab(prevTab);
            trigger('selection');
          }
        }
      }
    }
  };

  const contentSegments = [
    { id: 'overview' as const, label: t.nav?.account || 'Overview' },
    { id: 'trade' as const, label: t.nav?.trade || 'Trade' },
    { id: 'chart' as const, label: t.orderBook?.chart || 'Chart' },
    { id: 'depth' as const, label: t.orderBook?.depth || 'Depth' },
    { id: 'orderbook' as const, label: t.orderBook?.title || 'Book' },
    { id: 'trades' as const, label: t.recentTrades?.title || 'Trades' },
  ];

  const priceChangePercent = metrics?.priceChangePercent24h 
    ? parseFloat(metrics.priceChangePercent24h)
    : 0;

  // Calculate position PnL
  const positionPnL = useMemo(() => {
    if (!currentPosition || !metrics?.mid) return null;
    const currentPrice = parseFloat(metrics.mid);
    const avgEntryPrice = parseFloat(currentPosition.avgEntryPrice);
    if (!avgEntryPrice || isNaN(avgEntryPrice)) return null;
    
    const qty = parseFloat(currentPosition.quantity);
    const pnl = (currentPrice - avgEntryPrice) * qty;
    const pnlPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
    return { pnl, pnlPercent, avgEntryPrice, qty };
  }, [currentPosition, metrics?.mid]);

  return (
    <div className={styles.container}>
      {/* Header: Symbol Info */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.symbolSection}>
            <button className={styles.symbolBtn} onClick={() => setShowSymbolSelector(true)}>
              <span className={styles.symbolName}>{baseAsset}</span>
              <span className={styles.symbolQuote}>/USDT</span>
              <Icon name="chevron-down" size="xs" />
            </button>
          </div>

          <div className={styles.priceSection}>
            <div className={styles.priceInfo}>
              <span className={`${styles.currentPrice} tabular-nums ${priceChangePercent >= 0 ? styles.positive : styles.negative} ${priceFlash ? styles.priceJump : ''}`}>
                {metrics?.mid ? formatPrice(parseFloat(metrics.mid)) : '—'}
              </span>
              <span className={`${styles.priceChange} tabular-nums ${priceChangePercent >= 0 ? styles.positive : styles.negative}`}>
                {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className={styles.headerStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>24H H</span>
            <span className={`${styles.statValue} tabular-nums`}>{metrics?.high24h ? formatPrice(parseFloat(metrics.high24h)) : '—'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>24H L</span>
            <span className={`${styles.statValue} tabular-nums`}>{metrics?.low24h ? formatPrice(parseFloat(metrics.low24h)) : '—'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>24H Vol</span>
            <span className={`${styles.statValue} tabular-nums`}>{metrics?.vol24h ? formatVolume(parseFloat(metrics.vol24h)) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNav}>
        <MobileSegmentedControl
          segments={contentSegments}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as ContentTab)}
          variant="underline"
          scrollable
        />
      </div>

      {/* Content Area - Swipeable */}
      <div
        ref={contentRef}
        className={styles.content}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === 'overview' && (
          <ErrorBoundary name="MobileOverview" fallback={<PanelFallback name="Overview" />}>
            <TradeOverview onTradeClick={handleOpenOrder} />
          </ErrorBoundary>
        )}

        {activeTab === 'trade' && (
          <ErrorBoundary name="MobileUnifiedTrade" fallback={<PanelFallback name="Trade" />}>
            <div className={styles.unifiedTradeWrapper}>
              <div className={styles.compactChart}>
                <PriceChart />
              </div>
              <div className={styles.unifiedBook}>
                <OrderBook onPriceClick={handlePriceClick} compact />
              </div>
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'chart' && (
          <ErrorBoundary name="MobileChart" fallback={<PanelFallback name="Chart" />}>
            <div className={styles.chartWrapper}>
              <PriceChart />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'depth' && (
          <ErrorBoundary name="MobileDepth" fallback={<PanelFallback name="Depth" />}>
            <div className={styles.depthRiskWrapper}>
              <RiskRibbon />
              <div className={styles.depthWrapper}>
                <DepthChart />
              </div>
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'orderbook' && (
          <ErrorBoundary name="MobileOrderBook" fallback={<PanelFallback name="OrderBook" />}>
            <OrderBook onPriceClick={handlePriceClick} compact />
          </ErrorBoundary>
        )}

        {activeTab === 'trades' && (
          <ErrorBoundary name="MobileTrades" fallback={<PanelFallback name="Trades" />}>
            <RecentTrades onPriceClick={(price) => handlePriceClick(price)} compact />
          </ErrorBoundary>
        )}
      </div>

      {/* Account & Position Info Bar */}
      <div className={`${styles.infoBar} ${activeTab === 'overview' ? styles.hidden : ''}`}>
        <div className={styles.infoGrid}>
          {/* Total Account Value */}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t.account?.totalValue || 'Equity'}</span>
            <span className={`${styles.infoValue} tabular-nums`}>
              ${accountInfo.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Available USDT */}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t.account?.available || 'Avail'} (USDT)</span>
            <span className={`${styles.infoValue} tabular-nums`}>
              ${accountInfo.usdtAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Holdings Qty */}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{baseAsset} {t.wallet?.balance || 'Bal'}</span>
            <span className={`${styles.infoValue} tabular-nums`}>
              {accountInfo.baseQty.toFixed(4)}
            </span>
          </div>

          {/* Unrealized PnL */}
          {positionPnL && (
            <div className={`${styles.infoItem} ${styles.pnlItem}`}>
              <span className={styles.infoLabel}>{t.positions?.unrealizedPnL || 'UPnL'}</span>
              <span className={`${styles.infoValue} tabular-nums ${positionPnL.pnl >= 0 ? styles.positive : styles.negative}`}>
                {positionPnL.pnl >= 0 ? '+' : ''}{positionPnL.pnl.toFixed(2)} 
                <span className={styles.pnlPercent}>
                  ({positionPnL.pnlPercent >= 0 ? '+' : ''}{positionPnL.pnlPercent.toFixed(2)}%)
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Buttons */}
      {activeTab !== 'overview' && (
        <div className={styles.bottomActions}>
          <button
            className={`${styles.actionBtn} ${styles.buyBtn}`}
            onClick={() => handleOpenOrder('buy')}
          >
            <span className={styles.actionLabel}>{t.orderEntry?.buy || 'BUY'}</span>
          </button>
          <button
            className={`${styles.actionBtn} ${styles.sellBtn}`}
            onClick={() => handleOpenOrder('sell')}
          >
            <span className={styles.actionLabel}>{t.orderEntry?.sell || 'SELL'}</span>
          </button>
        </div>
      )}

      {/* Order Entry Drawer */}
      <MobileDrawer
        isOpen={isOrderDrawerOpen}
        onClose={() => setIsOrderDrawerOpen(false)}
        title={`${orderSide === 'buy' ? t.orderEntry?.buy || 'Buy' : t.orderEntry?.sell || 'Sell'} ${baseAsset}`}
        height="auto"
      >
        <MobileOrderEntry
          side={orderSide}
          onSideChange={setOrderSide}
          priceFromOrderBook={selectedPrice}
          onSuccess={() => setIsOrderDrawerOpen(false)}
        />
      </MobileDrawer>

      {/* Symbol Selector Drawer */}
      <MobileDrawer
        isOpen={showSymbolSelector}
        onClose={() => setShowSymbolSelector(false)}
        title={t.watchlist?.title || 'Select Symbol'}
        height="full"
      >
        <Watchlist onSymbolChange={handleSymbolChange} isCollapsed={false} compact />
      </MobileDrawer>
    </div>
  );
}

