import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Sparkline } from '../../components/Chart';
import { Icon } from '../../components/Icon';
import { MobileSegmentedControl, MobileActionSheet, PullToRefresh } from '../../components/mobile';
import { MobileHeader } from '../../components/Layout';
import { useWatchlistStore } from '../../store/watchlistStore';
import {
  fetchAllTickers,
  fetchSparkline,
  formatVolume,
  formatPrice,
  parseSymbol,
  type MarketTicker,
  type MarketSparkline,
} from '../../services/marketDataService';
import styles from './MarketsPage.mobile.module.css';

interface MarketData {
  symbol: string;
  ticker: MarketTicker | null;
  sparkline: MarketSparkline | null;
}

type Category = 'favorites' | 'all' | 'gainers' | 'losers' | 'volume';

export function MobileMarketsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MarketData | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [sparklinesLoaded, setSparklinesLoaded] = useState(false);

  const { favorites, toggleFavorite, addSymbol, setSelectedSymbol } = useWatchlistStore();

  // Swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipingItem = useRef<string | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    try {
      const tickers = await fetchAllTickers();
      const initialMarkets: MarketData[] = tickers.map(t => ({
        symbol: t.symbol,
        ticker: t,
        sparkline: null,
      }));

      setMarkets(prev => {
        if (prev.length === 0) return initialMarkets;
        return initialMarkets.map(m => {
          const existing = prev.find(p => p.symbol === m.symbol);
          return { ...m, sparkline: existing?.sparkline ?? null };
        });
      });
      setLoading(false);

      // Load sparklines for top assets
      if (isInitial && !sparklinesLoaded) {
        setSparklinesLoaded(true);
        const topSymbols = tickers.slice(0, 20);
        for (let i = 0; i < topSymbols.length; i++) {
          const ticker = topSymbols[i];
          if (!ticker) continue;
          
          const symbol = ticker.symbol;
          setTimeout(() => {
            fetchSparkline(symbol).then(s => {
              setMarkets(prev => prev.map(m => m.symbol === symbol ? { ...m, sparkline: s } : m));
            });
          }, i * 150);
        }
      }
    } catch (err) {
      console.error('Market load error:', err);
    }
  }, [sparklinesLoaded]);

  useEffect(() => {
    loadData(true);
    const timer = setInterval(() => loadData(false), 60000);
    return () => clearInterval(timer);
  }, [loadData]);

  const filteredMarkets = useMemo(() => {
    let filtered = markets.filter(m => {
      const matchesSearch = m.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && m.ticker;
    });

    switch (category) {
      case 'favorites':
        filtered = filtered.filter(m => favorites.includes(m.symbol));
        break;
      case 'gainers':
        filtered = filtered.filter(m => (m.ticker?.priceChangePercent ?? 0) > 0)
          .sort((a, b) => (b.ticker?.priceChangePercent ?? 0) - (a.ticker?.priceChangePercent ?? 0));
        break;
      case 'losers':
        filtered = filtered.filter(m => (m.ticker?.priceChangePercent ?? 0) < 0)
          .sort((a, b) => (a.ticker?.priceChangePercent ?? 0) - (b.ticker?.priceChangePercent ?? 0));
        break;
      case 'volume':
        filtered = filtered.sort((a, b) => (b.ticker?.quoteVolume24h ?? 0) - (a.ticker?.quoteVolume24h ?? 0));
        break;
      default:
        filtered = filtered.sort((a, b) => (b.ticker?.quoteVolume24h ?? 0) - (a.ticker?.quoteVolume24h ?? 0));
    }

    return filtered;
  }, [markets, searchTerm, category, favorites]);

  const stats = useMemo(() => {
    const active = markets.filter(m => m.ticker);
    const gainers = active.filter(m => (m.ticker?.priceChangePercent ?? 0) > 0);
    const losers = active.filter(m => (m.ticker?.priceChangePercent ?? 0) < 0);
    return {
      total: active.length,
      gainers: gainers.length,
      losers: losers.length,
      favorites: favorites.length,
    };
  }, [markets, favorites]);

  const handleSelect = (symbol: string) => {
    const { base, quote } = parseSymbol(symbol);
    addSymbol({ symbol, baseAsset: base, quoteAsset: quote });
    setSelectedSymbol(symbol);
    navigate('/trade');
  };

  const handleLongPress = (market: MarketData) => {
    setSelectedAsset(market);
    setShowActionSheet(true);
  };

  const handleSwipeAction = (symbol: string, action: 'favorite' | 'trade') => {
    if (action === 'favorite') {
      toggleFavorite(symbol);
    } else {
      handleSelect(symbol);
    }
  };

  // Touch handlers for swipe detection
  const handleTouchStart = (symbol: string) => (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipingItem.current = symbol;
  };

  const handleTouchEnd = (symbol: string) => (e: React.TouchEvent) => {
    if (swipingItem.current !== symbol || !e.changedTouches[0]) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      if (deltaX > 0) {
        // Swipe right - toggle favorite
        handleSwipeAction(symbol, 'favorite');
      } else {
        // Swipe left - go to trade
        handleSwipeAction(symbol, 'trade');
      }
    }
    
    swipingItem.current = null;
  };

  const categorySegments = [
    { 
      id: 'favorites' as const, 
      label: '★', 
      badge: stats.favorites,
      className: styles.favoritesSegment 
    },
    { id: 'all' as const, label: t.markets?.all || 'All' },
    { id: 'gainers' as const, label: t.markets?.gainers || 'Gainers', badge: stats.gainers },
    { id: 'losers' as const, label: t.markets?.losers || 'Losers', badge: stats.losers },
    { id: 'volume' as const, label: t.markets?.volume || 'Volume' },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <MobileHeader
        title={t.nav?.markets || 'Markets'}
        rightAction={
          <button className={styles.searchToggle} onClick={() => setShowSearch(!showSearch)}>
            <Icon name={showSearch ? 'x' : 'search'} size="md" />
          </button>
        }
      />

      {/* Search Bar */}
      {showSearch && (
        <div className={styles.searchBar}>
          <Icon name="search" size="sm" className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t.markets?.searchPlaceholder || 'Search assets...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          {searchTerm && (
            <button className={styles.clearBtn} onClick={() => setSearchTerm('')}>
              <Icon name="x" size="sm" />
            </button>
          )}
        </div>
      )}

      {/* Category Tabs */}
      <div className={styles.categoryNav}>
        <MobileSegmentedControl
          segments={categorySegments}
          activeId={category}
          onChange={(id) => setCategory(id as Category)}
          variant="underline"
          scrollable
        />
      </div>

      {/* Market List */}
      <PullToRefresh onRefresh={async () => { await loadData(false); }} className={styles.list}>
        {loading ? (
          <div className={styles.loading}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '60px', height: '16px', marginBottom: '4px' }} />
                  <div className="skeleton" style={{ width: '40px', height: '12px' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
                  <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className={styles.empty}>
            <Icon name="inbox" size="xl" />
            <span>{category === 'favorites' ? (t.markets?.emptyFavorites || 'No favorites yet') : (t.markets?.emptySearch || 'No results found')}</span>
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <div
              key={market.symbol}
              className={styles.marketItem}
              onClick={() => handleSelect(market.symbol)}
              onTouchStart={handleTouchStart(market.symbol)}
              onTouchEnd={handleTouchEnd(market.symbol)}
              onContextMenu={(e) => { e.preventDefault(); handleLongPress(market); }}
            >
              {/* Asset Info */}
              <div className={styles.assetInfo}>
                <span className={styles.assetName}>{parseSymbol(market.symbol).base}</span>
                <div className={styles.assetQuoteRow}>
                  <span className={styles.assetQuote}>/USDT</span>
                  <span className={styles.volume}>
                    Vol: {market.ticker ? formatVolume(market.ticker.quoteVolume24h) : '—'}
                  </span>
                </div>
              </div>

              {/* Sparkline Column */}
              <div className={styles.sparklineCol}>
                {market.sparkline && (
                  <Sparkline
                    data={market.sparkline.prices}
                    height={60}
                    width={200}
                    lineWidth={1.5}
                    color={(market.ticker?.priceChangePercent ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
                  />
                )}
              </div>

              {/* Watermark Logo/Text */}
              <div className={styles.watermark}>
                <span className={styles.watermarkText}>{parseSymbol(market.symbol).base}</span>
              </div>
              <div className={styles.priceCol}>
                <span className={`${styles.price} tabular-nums`}>
                  {market.ticker ? formatPrice(market.ticker.price) : '—'}
                </span>
                <div
                  className={`${styles.changeBadge} ${
                    (market.ticker?.priceChangePercent ?? 0) >= 0 ? styles.positive : styles.negative
                  }`}
                >
                  {market.ticker
                    ? `${market.ticker.priceChangePercent > 0 ? '+' : ''}${market.ticker.priceChangePercent.toFixed(2)}%`
                    : '—'}
                </div>
              </div>
            </div>
          ))
        )}
      </PullToRefresh>

      {/* Swipe Hint */}
      <div className={styles.swipeHint}>
        <span>{t.markets?.swipeHint || '← Swipe to trade | Swipe to favorite →'}</span>
      </div>

      {/* Action Sheet */}
      <MobileActionSheet
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        title={selectedAsset ? parseSymbol(selectedAsset.symbol).base : ''}
        message={selectedAsset?.ticker 
          ? `$${formatPrice(selectedAsset.ticker.price)} (${selectedAsset.ticker.priceChangePercent > 0 ? '+' : ''}${selectedAsset.ticker.priceChangePercent.toFixed(2)}%)`
          : undefined
        }
        actions={[
          { id: 'trade', label: t.markets?.goToTrade || 'Trade', icon: 'chevron-right' },
          { 
            id: 'favorite', 
            label: selectedAsset && favorites.includes(selectedAsset.symbol) 
              ? (t.markets?.removeFavorite || 'Remove from Favorites')
              : (t.markets?.addFavorite || 'Add to Favorites'),
            icon: 'star'
          },
        ]}
        onAction={(actionId) => {
          if (!selectedAsset) return;
          if (actionId === 'trade') {
            handleSelect(selectedAsset.symbol);
          } else if (actionId === 'favorite') {
            toggleFavorite(selectedAsset.symbol);
          }
        }}
      />
    </div>
  );
}

