import { useEffect, useState, useCallback, useRef } from 'react';
import { OrderBook } from '../../components/OrderBook';
import { MetricsPanel } from '../../components/MetricsPanel';
import { RecentTrades } from '../../components/RecentTrades';
import { PriceChart } from '../../components/Chart';
import { Watchlist } from '../../components/Watchlist';
import { BottomTabs } from '../../components/BottomTabs';
import { DepthChart } from '../../components/DepthChart';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Icon } from '../../components/Icon';
import { MobileDrawer, MobileSegmentedControl } from '../../components/mobile';
import { MobileOrderEntry } from './MobileOrderEntry';
import { useMarketStore, selectOrderBook, selectMetrics } from '../../store/marketStore';
import { useTradingStore } from '../../store/tradingStore';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import styles from './TradePage.mobile.module.css';

type ContentTab = 'chart' | 'depth' | 'orderbook' | 'trades';

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
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);

  const [activeTab, setActiveTab] = useState<ContentTab>('chart');
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [selectedPrice, setSelectedPrice] = useState<string | undefined>();
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);

  // Touch handling for swipe navigation
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const tabs: ContentTab[] = ['chart', 'depth', 'orderbook', 'trades'];

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
    trigger('medium');
    setOrderSide(side);
    setIsOrderDrawerOpen(true);
  };

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
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const currentIndex = tabs.indexOf(activeTab);
      if (deltaX < 0 && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        setActiveTab(tabs[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - previous tab
        setActiveTab(tabs[currentIndex - 1]);
      }
    }
  };

  const contentSegments = [
    { id: 'chart' as const, label: t.orderBook?.chart || 'Chart', icon: <Icon name="trending-up" size="sm" /> },
    { id: 'depth' as const, label: t.orderBook?.depth || 'Depth', icon: <Icon name="layers" size="sm" /> },
    { id: 'orderbook' as const, label: t.orderBook?.title || 'Book', icon: <Icon name="book-open" size="sm" /> },
    { id: 'trades' as const, label: t.recentTrades?.title || 'Trades', icon: <Icon name="activity" size="sm" /> },
  ];

  const baseAsset = selectedSymbol.replace('USDT', '');
  const priceChangePercent = metrics?.high24h && metrics?.low24h 
    ? (((parseFloat(metrics.mid) - parseFloat(metrics.low24h)) / parseFloat(metrics.low24h)) * 100)
    : 0;

  return (
    <div className={styles.container}>
      {/* Header: Symbol Info */}
      <div className={styles.header}>
        <button className={styles.symbolBtn} onClick={() => setShowSymbolSelector(true)}>
          <span className={styles.symbolName}>{baseAsset}</span>
          <span className={styles.symbolQuote}>/USDT</span>
          <Icon name="chevron-down" size="sm" />
        </button>

        <div className={styles.priceInfo}>
          <span className={`${styles.currentPrice} tabular-nums`}>
            {metrics?.mid || '—'}
          </span>
          <span className={`${styles.priceChange} tabular-nums ${priceChangePercent >= 0 ? styles.positive : styles.negative}`}>
            {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
          </span>
        </div>

        <div className={styles.headerStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t.trade?.stats24hHigh || '24H High'}</span>
            <span className={`${styles.statValue} tabular-nums`}>{metrics?.high24h || '—'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t.trade?.stats24hLow || '24H Low'}</span>
            <span className={`${styles.statValue} tabular-nums`}>{metrics?.low24h || '—'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t.trade?.stats24hVol || '24H Vol'}</span>
            <span className={`${styles.statValue} tabular-nums`}>{metrics?.vol24h || '—'}</span>
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
        {activeTab === 'chart' && (
          <ErrorBoundary name="MobileChart" fallback={<PanelFallback name="Chart" />}>
            <div className={styles.chartWrapper}>
              <PriceChart />
              <MetricsPanel compact />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'depth' && (
          <ErrorBoundary name="MobileDepth" fallback={<PanelFallback name="Depth" />}>
            <div className={styles.depthWrapper}>
              <DepthChart />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'orderbook' && (
          <ErrorBoundary name="MobileOrderBook" fallback={<PanelFallback name="OrderBook" />}>
            <OrderBook onPriceClick={handlePriceClick} />
          </ErrorBoundary>
        )}

        {activeTab === 'trades' && (
          <ErrorBoundary name="MobileTrades" fallback={<PanelFallback name="Trades" />}>
            <RecentTrades onPriceClick={(price) => handlePriceClick(price)} />
          </ErrorBoundary>
        )}
      </div>

      {/* Bottom Action Buttons */}
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

