import { useEffect, useState, useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { OrderBook } from '../components/OrderBook';
import { MetricsPanel } from '../components/MetricsPanel';
import { RecentTrades } from '../components/RecentTrades';
import { OrderEntry } from '../components/OrderEntry';
import { RiskRibbon } from '../components/RiskRibbon';
import { PriceChart } from '../components/Chart';
import { Watchlist } from '../components/Watchlist';
import { BottomTabs } from '../components/BottomTabs';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AccountOverviewPanel } from '../components/AccountOverviewPanel';
import { Icon } from '../components/Icon';
import { useMarketStore, selectOrderBook } from '../store/marketStore';
import { useTradingStore } from '../store/tradingStore';
import { useWatchlistStore, selectSelectedSymbol } from '../store/watchlistStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';
import styles from './TradePage.module.css';

const PanelFallback = ({ name }: { name: string }) => (
  <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '10px' }}>
    PANEL_ERROR: {name}
  </div>
);

const ResizeHandle = ({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) => (
  <PanelResizeHandle className={orientation === 'horizontal' ? styles.resizeHandleHorizontal : styles.resizeHandleVertical}>
    <div className={styles.resizeHandleInner} />
  </PanelResizeHandle>
);

// Mobile Tab Types
type MobileTab = 'chart' | 'orderbook' | 'trades' | 'positions';

export function TradePage() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const orderBook = useMarketStore(selectOrderBook);
  const subscribe = useMarketStore((state) => state.subscribe);
  const unsubscribe = useMarketStore((state) => state.unsubscribe);
  const updateOrderBookForMatching = useTradingStore((state) => state.updateOrderBookForMatching);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  
  const [selectedPrice, setSelectedPrice] = useState<{ value: string; timestamp: number } | undefined>();
  const [selectedSide, setSelectedSide] = useState<'buy' | 'sell' | undefined>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  const [isOrderEntryExpanded, setIsOrderEntryExpanded] = useState(false);

  const handlePriceClick = useCallback((price: string, side?: 'buy' | 'sell') => {
    setSelectedPrice({ value: price, timestamp: Date.now() });
    if (side) setSelectedSide(side);
    // On mobile, expand order entry when price is clicked
    if (isMobile) setIsOrderEntryExpanded(true);
  }, [isMobile]);

  const handleSymbolChange = useCallback((_symbol: string) => {
    setSelectedPrice(undefined);
    setSelectedSide(undefined);
  }, []);

  useEffect(() => {
    subscribe(selectedSymbol);
    return () => unsubscribe();
  }, [selectedSymbol, subscribe, unsubscribe]);

  useEffect(() => {
    if (orderBook) {
      updateOrderBookForMatching(orderBook);
    }
  }, [orderBook, updateOrderBookForMatching]);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className={styles.mobileContainer}>
        {/* Mobile Header with Symbol Info */}
        <div className={styles.mobileHeader}>
          <ErrorBoundary name="MobileWatchlist" fallback={<span>Error</span>}>
            <Watchlist onSymbolChange={handleSymbolChange} isCollapsed={false} compact />
          </ErrorBoundary>
        </div>

        {/* Mobile Tab Navigation */}
        <div className={styles.mobileTabNav}>
          {(['chart', 'orderbook', 'trades', 'positions'] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              className={`${styles.mobileTabBtn} ${mobileTab === tab ? styles.active : ''}`}
              onClick={() => setMobileTab(tab)}
            >
              <Icon 
                name={
                  tab === 'chart' ? 'trending-up' : 
                  tab === 'orderbook' ? 'book-open' : 
                  tab === 'trades' ? 'activity' : 
                  'layers'
                } 
                size="sm" 
              />
              <span>
                {tab === 'chart' ? t.orderBook?.chart || 'Chart' :
                 tab === 'orderbook' ? t.orderBook?.title || 'Book' :
                 tab === 'trades' ? t.recentTrades?.title || 'Trades' :
                 t.positions?.title || 'Positions'}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile Content Area */}
        <div className={styles.mobileContent}>
          {mobileTab === 'chart' && (
            <ErrorBoundary name="MobileChart" fallback={<PanelFallback name="CHART" />}>
              <div className={styles.mobileChartWrapper}>
                <PriceChart />
                <MetricsPanel compact />
              </div>
            </ErrorBoundary>
          )}
          {mobileTab === 'orderbook' && (
            <ErrorBoundary name="MobileOrderBook" fallback={<PanelFallback name="ORDERBOOK" />}>
              <OrderBook onPriceClick={handlePriceClick} />
            </ErrorBoundary>
          )}
          {mobileTab === 'trades' && (
            <ErrorBoundary name="MobileTrades" fallback={<PanelFallback name="TRADES" />}>
              <RecentTrades onPriceClick={(price) => handlePriceClick(price)} />
            </ErrorBoundary>
          )}
          {mobileTab === 'positions' && (
            <ErrorBoundary name="MobilePositions" fallback={<PanelFallback name="POSITIONS" />}>
              <BottomTabs onPriceClick={handlePriceClick} defaultTab="positions" />
            </ErrorBoundary>
          )}
        </div>

        {/* Mobile Account Summary - Collapsible */}
        <div className={`${styles.mobileAccountSummary} ${isOrderEntryExpanded ? styles.expanded : ''}`}>
          <button 
            className={styles.accountToggle}
            onClick={() => setIsOrderEntryExpanded(!isOrderEntryExpanded)}
          >
            <ErrorBoundary name="MobileRisk" fallback={<span>--</span>}>
              <RiskRibbon compact />
            </ErrorBoundary>
            <Icon name={isOrderEntryExpanded ? 'chevron-down' : 'chevron-up'} size="sm" />
          </button>
          
          {isOrderEntryExpanded && (
            <div className={styles.mobileOrderEntry}>
              <ErrorBoundary name="MobileOrderEntry" fallback={<PanelFallback name="ORDER" />}>
                <OrderEntry 
                  priceFromOrderBook={selectedPrice?.value} 
                  sideFromOrderBook={selectedSide} 
                  key={selectedPrice?.timestamp}
                  compact
                />
              </ErrorBoundary>
            </div>
          )}
        </div>

        {/* Quick Order Buttons - Always Visible */}
        <div className={styles.mobileQuickOrder}>
          <button 
            className={`${styles.quickOrderBtn} ${styles.buyBtn}`}
            onClick={() => {
              setSelectedSide('buy');
              setIsOrderEntryExpanded(true);
            }}
          >
            {t.orderEntry?.buy || 'BUY'}
          </button>
          <button 
            className={`${styles.quickOrderBtn} ${styles.sellBtn}`}
            onClick={() => {
              setSelectedSide('sell');
              setIsOrderEntryExpanded(true);
            }}
          >
            {t.orderEntry?.sell || 'SELL'}
          </button>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className={styles.container}>
      <PanelGroup orientation="horizontal" className={styles.mainLayout}>
        {/* Left Sidebar: Watchlist + Recent Trades */}
        <Panel 
          defaultSize={15} 
          minSize={5} 
          collapsible 
          onResize={(size) => {
            setIsSidebarCollapsed(size.asPercentage === 0);
          }}
          className={styles.leftPanel}
        >
          <div className={styles.sidebarContent}>
            <ErrorBoundary name="Watchlist" fallback={<PanelFallback name="WATCHLIST" />}>
              <Watchlist onSymbolChange={handleSymbolChange} isCollapsed={isSidebarCollapsed} />
            </ErrorBoundary>
            {!isSidebarCollapsed && (
              <ErrorBoundary name="RecentTrades" fallback={<PanelFallback name="TRADES" />}>
                <RecentTrades onPriceClick={(price) => handlePriceClick(price)} />
              </ErrorBoundary>
            )}
          </div>
        </Panel>

        <ResizeHandle />

        {/* Center Area: Chart + Bottom Tabs */}
        <Panel defaultSize={55} minSize={30} className={styles.centerPanel}>
          <PanelGroup orientation="vertical" className={styles.centerPanelGroup}>
            <Panel defaultSize={64} minSize={25} className={styles.chartPanel}>
              <div className={styles.chartArea}>
                <div className={styles.chartContainer}>
                  <ErrorBoundary name="PriceChart" fallback={<PanelFallback name="PRICE_CHART" />}>
                    <PriceChart />
                  </ErrorBoundary>
                </div>
                <ErrorBoundary name="Metrics" fallback={<PanelFallback name="METRICS" />}>
                  <MetricsPanel />
                </ErrorBoundary>
              </div>
            </Panel>
            
            <ResizeHandle orientation="vertical" />
            
            <Panel defaultSize={36} minSize={15}>
              <ErrorBoundary name="BottomTabs" fallback={<PanelFallback name="BOTTOM_TABS" />}>
                <BottomTabs onPriceClick={handlePriceClick} />
              </ErrorBoundary>
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle />

        {/* Right Sidebar: Account Overview + Order Entry + OrderBook */}
        <Panel defaultSize={18} minSize={12} className={styles.rightPanel}>
          <div className={styles.rightContent}>
            <div className={styles.accountOverviewWrapper}>
              <ErrorBoundary name="AccountOverview" fallback={<PanelFallback name="ACCOUNT" />}>
                <AccountOverviewPanel />
              </ErrorBoundary>
            </div>
            <ErrorBoundary name="Risk" fallback={<PanelFallback name="RISK" />}>
              <RiskRibbon />
            </ErrorBoundary>
            <div className={styles.orderEntryWrapper}>
              <ErrorBoundary name="OrderEntry" fallback={<PanelFallback name="ORDER_ENTRY" />}>
                <OrderEntry 
                  priceFromOrderBook={selectedPrice?.value} 
                  sideFromOrderBook={selectedSide} 
                  key={selectedPrice?.timestamp}
                />
              </ErrorBoundary>
            </div>
            <div className={styles.orderBookWrapper}>
              <ErrorBoundary name="OrderBook" fallback={<PanelFallback name="ORDERBOOK" />}>
                <OrderBook onPriceClick={handlePriceClick} />
              </ErrorBoundary>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
