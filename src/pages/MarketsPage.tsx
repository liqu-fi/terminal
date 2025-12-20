import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Sparkline } from '../components/Chart';
import { Icon, IconName } from '../components/Icon';
import { useWatchlistStore } from '../store/watchlistStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MobileMarketsPage } from './mobile';
import {
  fetchAllTickers,
  fetchSparkline,
  calculateIndicators,
  formatVolume,
  formatPrice,
  parseSymbol,
  type MarketTicker,
  type MarketSparkline,
  type MarketIndicators,
} from '../services/marketDataService';
import styles from './MarketsPage.module.css';

interface MarketData {
  symbol: string;
  ticker: MarketTicker | null;
  sparkline: MarketSparkline | null;
  indicators: MarketIndicators | null;
}

export function MarketsPage() {
  const isMobile = useIsMobile();

  // Render mobile layout
  if (isMobile) {
    return <MobileMarketsPage />;
  }

  const { t: _t } = useI18n();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<keyof MarketTicker>('quoteVolume24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { favorites, toggleFavorite, addSymbol, setSelectedSymbol } = useWatchlistStore();

  // Track if we've already loaded sparklines to avoid re-fetching
  const [sparklinesLoaded, setSparklinesLoaded] = useState(false);

  const loadData = useCallback(async (isInitial = false) => {
    try {
      const tickers = await fetchAllTickers();
      const initialMarkets: MarketData[] = tickers.map(t => ({
        symbol: t.symbol,
        ticker: t,
        sparkline: null,
        indicators: null,
      }));
      
      // Preserve existing sparklines and indicators when refreshing
      setMarkets(prev => {
        if (prev.length === 0) return initialMarkets;
        return initialMarkets.map(m => {
          const existing = prev.find(p => p.symbol === m.symbol);
          return {
            ...m,
            sparkline: existing?.sparkline ?? null,
            indicators: existing?.indicators ?? null,
          };
        });
      });
      setLoading(false);

      // Only fetch sparklines and indicators on initial load to avoid rate limiting
      if (isInitial && !sparklinesLoaded) {
        setSparklinesLoaded(true);
        // Fetch sparklines in batches with delay to avoid rate limits
        const topSymbols = tickers.slice(0, 30); // Reduced from 50 to 30
        for (let i = 0; i < topSymbols.length; i++) {
          const ticker = topSymbols[i];
          if (!ticker) continue;
          
          const symbol = ticker.symbol;
          // Add small delay between requests to spread load
          setTimeout(() => {
            fetchSparkline(symbol).then(s => {
              setMarkets(prev => prev.map(m => m.symbol === symbol ? { ...m, sparkline: s } : m));
            });
            calculateIndicators(symbol).then(ind => {
              setMarkets(prev => prev.map(m => m.symbol === symbol ? { ...m, indicators: ind } : m));
            });
          }, i * 100); // 100ms delay between each request
        }
      }
    } catch (err) {
      console.error('Market load error:', err);
    }
  }, [sparklinesLoaded]);

  useEffect(() => {
    loadData(true);
    // Increase interval from 10s to 60s to avoid Binance rate limits [[memory:12434456]]
    const timer = setInterval(() => loadData(false), 60000);
    return () => clearInterval(timer);
  }, [loadData]);

  const filteredMarkets = useMemo(() => {
    // First filter by search term
    let filtered = markets.filter(m => {
      const matchesSearch = m.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && m.ticker;
    });

    // Apply category filter
    switch (category) {
      case 'Favorites':
        filtered = filtered.filter(m => favorites.includes(m.symbol));
        break;
      case 'Gainers':
        filtered = filtered.filter(m => (m.ticker?.priceChangePercent ?? 0) > 0);
        break;
      case 'Losers':
        filtered = filtered.filter(m => (m.ticker?.priceChangePercent ?? 0) < 0);
        break;
      case 'High Volume':
        // Get top 20% by volume
        const sortedByVol = [...filtered].sort((a, b) => 
          (b.ticker?.quoteVolume24h ?? 0) - (a.ticker?.quoteVolume24h ?? 0)
        );
        const topCount = Math.max(20, Math.floor(sortedByVol.length * 0.2));
        const topSymbols = new Set(sortedByVol.slice(0, topCount).map(m => m.symbol));
        filtered = filtered.filter(m => topSymbols.has(m.symbol));
        break;
      case 'Volatile':
        // Show assets with >5% absolute change
        filtered = filtered.filter(m => Math.abs(m.ticker?.priceChangePercent ?? 0) >= 5);
        break;
      default: // 'All'
        break;
    }

    // Sort
    return filtered.sort((a, b) => {
      if (!a.ticker || !b.ticker) return 0;
      const vA = a.ticker[sortField] as number;
      const vB = b.ticker[sortField] as number;
      return sortOrder === 'desc' ? vB - vA : vA - vB;
    });
  }, [markets, searchTerm, category, favorites, sortField, sortOrder]);

  const stats = useMemo(() => {
    const active = markets.filter(m => m.ticker);
    const gainers = active.filter(m => (m.ticker?.priceChangePercent ?? 0) > 0);
    const losers = active.filter(m => (m.ticker?.priceChangePercent ?? 0) < 0);
    const neutral = active.length - gainers.length - losers.length;
    const volatile = active.filter(m => Math.abs(m.ticker?.priceChangePercent ?? 0) >= 5);
    const totalVol = active.reduce((acc, m) => acc + (m.ticker?.quoteVolume24h ?? 0), 0);
    const avgChange = active.length > 0 
      ? active.reduce((acc, m) => acc + (m.ticker?.priceChangePercent ?? 0), 0) / active.length 
      : 0;
    
    // High volume count (top 20%)
    const highVolCount = Math.max(20, Math.floor(active.length * 0.2));
    
    // Find top gainer
    const topGainer = active.length > 0 ? active.reduce((best, current) => {
      if (!best?.ticker) return current;
      if (!current?.ticker) return best;
      return current.ticker.priceChangePercent > best.ticker.priceChangePercent ? current : best;
    }, active[0]) : null;
    
    // Find volume leader
    const volumeLeader = active.length > 0 ? active.reduce((best, current) => {
      if (!best?.ticker) return current;
      if (!current?.ticker) return best;
      return current.ticker.quoteVolume24h > best.ticker.quoteVolume24h ? current : best;
    }, active[0]) : null;
    
    return { 
      up: gainers.length, 
      down: losers.length, 
      neutral, 
      volatileCount: volatile.length,
      highVolCount,
      totalVol, 
      avgChange, 
      topGainer, 
      volumeLeader, 
      totalPairs: active.length 
    };
  }, [markets]);

  const handleSelect = (symbol: string) => {
    const { base, quote } = parseSymbol(symbol);
    addSymbol({ symbol, baseAsset: base, quoteAsset: quote });
    setSelectedSymbol(symbol);
    navigate('/trade');
  };

  const handleSort = (field: keyof MarketTicker) => {
    if (sortField === field) setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  return (
    <div className={styles.container}>
      {/* Header Intelligence Dashboard */}
      <div className={styles.dashboard}>
        {/* Card 1: Market Sentiment */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Market Sentiment</span>
            <span className={`${styles.sentimentBadge} ${stats.avgChange >= 0 ? styles.bullish : styles.bearish}`}>
              {stats.avgChange >= 0 ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>
          <div className={styles.breadthBar}>
            <div className={styles.breadthUp} style={{ width: `${(stats.up / (stats.totalPairs || 1)) * 100}%` }} />
          </div>
          <div className={styles.breadthLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--color-price-up)' }} />
              <span className={styles.legendValue}>{stats.up}</span>
              <span className={styles.legendLabel}>Gainers</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--text-tertiary)' }} />
              <span className={styles.legendValue}>{stats.neutral}</span>
              <span className={styles.legendLabel}>Neutral</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--color-price-down)' }} />
              <span className={styles.legendValue}>{stats.down}</span>
              <span className={styles.legendLabel}>Decliners</span>
            </div>
          </div>
        </div>

        {/* Card 2: 24h Trading Volume */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>24h Trading Volume</span>
            <span className={styles.pairCount}>{stats.totalPairs} pairs</span>
          </div>
          <span className={styles.statValue}>${formatVolume(stats.totalVol)}</span>
          <div className={styles.volumeSubtext}>
            <span>Aggregate USDT Volume</span>
          </div>
        </div>

        {/* Card 3: Top Performer */}
        <div 
          className={`${styles.statCard} ${styles.clickableCard}`}
          onClick={() => stats.topGainer && handleSelect(stats.topGainer.symbol)}
        >
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Top Performer</span>
            <span className={styles.timeframe}>24H</span>
          </div>
          {stats.topGainer?.ticker ? (
            <div className={styles.assetHighlight}>
              <div className={styles.assetMain}>
                <span className={styles.assetSymbol}>{parseSymbol(stats.topGainer.symbol).base}</span>
                <span className={styles.assetQuote}>/ USDT</span>
              </div>
              <div className={styles.assetMetrics}>
                <span className={`${styles.changeValue} price-up`}>
                  +{stats.topGainer.ticker.priceChangePercent.toFixed(2)}%
                </span>
                <span className={styles.priceValue}>
                  ${formatPrice(stats.topGainer.ticker.price)}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.skeletonLarge} />
          )}
        </div>

        {/* Card 4: Volume Leader */}
        <div 
          className={`${styles.statCard} ${styles.clickableCard}`}
          onClick={() => stats.volumeLeader && handleSelect(stats.volumeLeader.symbol)}
        >
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Volume Leader</span>
            <span className={styles.timeframe}>24H</span>
          </div>
          {stats.volumeLeader?.ticker ? (
            <div className={styles.assetHighlight}>
              <div className={styles.assetMain}>
                <span className={styles.assetSymbol}>{parseSymbol(stats.volumeLeader.symbol).base}</span>
                <span className={styles.assetQuote}>/ USDT</span>
              </div>
              <div className={styles.assetMetrics}>
                <span className={styles.volumeValue}>
                  ${formatVolume(stats.volumeLeader.ticker.quoteVolume24h)}
                </span>
                <span className={`${styles.priceValue} ${(stats.volumeLeader.ticker.priceChangePercent ?? 0) >= 0 ? 'price-up' : 'price-down'}`}>
                  {stats.volumeLeader.ticker.priceChangePercent > 0 ? '+' : ''}{stats.volumeLeader.ticker.priceChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.skeletonLarge} />
          )}
        </div>
      </div>

      <div className={`card ${styles.mainCard}`}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {[
              { id: 'All', label: 'All', icon: null, count: stats.totalPairs },
              { id: 'Favorites', label: 'Favorites', icon: 'star', count: favorites.length },
              { id: 'Gainers', label: 'Gainers', icon: 'trending-up', count: stats.up },
              { id: 'Losers', label: 'Losers', icon: 'trending-down', count: stats.down },
              { id: 'High Volume', label: 'Top Volume', icon: 'bar-chart-3', count: stats.highVolCount },
              { id: 'Volatile', label: 'Volatile', icon: 'activity' as IconName, count: stats.volatileCount },
            ].map(tab => (
              <button 
                key={tab.id}
                className={`${styles.tab} ${category === tab.id ? styles.activeTab : ''} ${
                  tab.id === 'Gainers' ? styles.tabGainer : 
                  tab.id === 'Losers' ? styles.tabLoser : ''
                }`}
                onClick={() => setCategory(tab.id)}
              >
                {tab.icon && <Icon name={tab.icon as IconName} size="xs" />}
                <span>{tab.label}</span>
                <span className={styles.tabCount}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className={styles.searchWrapper}>
            <Icon name="search" size="sm" className={styles.searchIcon} />
            <input 
              className={styles.search}
              placeholder="Filter assets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.activeMode : ''}`} 
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <Icon name="layout-list" size="sm" />
            </button>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.activeMode : ''}`} 
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Icon name="layout-grid" size="sm" />
            </button>
          </div>
        </div>

        <div className={styles.tableArea}>
          {viewMode === 'table' ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th onClick={() => handleSort('symbol')} className={styles.sortable}>Asset</th>
                  <th onClick={() => handleSort('price')} className={styles.sortable}>Last Price</th>
                  <th onClick={() => handleSort('priceChangePercent')} className={styles.sortable}>24h Change</th>
                  <th onClick={() => handleSort('quoteVolume24h')} className={styles.sortable}>24h Volume</th>
                  <th>Indicators</th>
                  <th style={{ width: '120px' }}>Last 24h</th>
                  <th style={{ width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.map(m => (
                  <tr key={m.symbol} onClick={() => handleSelect(m.symbol)}>
                    <td>
                      <button 
                        className={`${styles.favBtn} ${favorites.includes(m.symbol) ? styles.isFav : ''}`}
                        onClick={e => { e.stopPropagation(); toggleFavorite(m.symbol); }}
                      >
                        <Icon name="star" size="sm" />
                      </button>
                    </td>
                    <td>
                      <div className={styles.assetCell}>
                        <span className={styles.base}>{parseSymbol(m.symbol).base}</span>
                        <span className={styles.quote}>/USDT</span>
                      </div>
                    </td>
                    <td className="tabular-nums font-medium">
                      {m.ticker ? formatPrice(m.ticker.price) : '---'}
                    </td>
                    <td className={`tabular-nums ${(m.ticker?.priceChangePercent ?? 0) >= 0 ? 'price-up' : 'price-down'}`}>
                      {m.ticker ? `${m.ticker.priceChangePercent > 0 ? '+' : ''}${m.ticker.priceChangePercent.toFixed(2)}%` : '---'}
                    </td>
                    <td className="tabular-nums text-secondary">
                      ${m.ticker ? formatVolume(m.ticker.quoteVolume24h) : '---'}
                    </td>
                    <td>
                      <div className={styles.indicatorCell}>
                        {m.indicators ? (
                          <>
                            <span className={`${styles.badge} ${m.indicators.rsi14 && m.indicators.rsi14 > 70 ? styles.warn : ''}`}>
                              RSI: {m.indicators.rsi14?.toFixed(0)}
                            </span>
                            <Icon 
                              name={m.indicators.momentum === 'bullish' ? 'trending-up' : 'trending-down'} 
                              size="xs" 
                              className={m.indicators.momentum === 'bullish' ? 'price-up' : 'price-down'}
                            />
                          </>
                        ) : <div className={styles.skeletonSmall} />}
                      </div>
                    </td>
                    <td>
                      {m.sparkline ? (
                        <Sparkline 
                          data={m.sparkline.prices} 
                          height={24} 
                          width={100} 
                          lineWidth={1.5}
                          color={(m.ticker?.priceChangePercent ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
                        />
                      ) : <div className={styles.skeletonWide} />}
                    </td>
                    <td>
                      <button className={styles.tradeBtn}>Execute</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.grid}>
              {filteredMarkets.map(m => (
                <div key={m.symbol} className={styles.card} onClick={() => handleSelect(m.symbol)}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardSymbol}>{parseSymbol(m.symbol).base}</span>
                    <span className={`${styles.cardChange} ${(m.ticker?.priceChangePercent ?? 0) >= 0 ? 'price-up' : 'price-down'}`}>
                      {m.ticker?.priceChangePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className={styles.cardPrice}>{m.ticker ? formatPrice(m.ticker.price) : '---'}</div>
                  <div className={styles.cardChart}>
                    {m.sparkline && (
                      <Sparkline 
                        data={m.sparkline.prices} 
                        height={60} 
                        width={180} 
                        lineWidth={1.5}
                        color={(m.ticker?.priceChangePercent ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
                      />
                    )}
                  </div>
                  <div className={styles.cardFooter}>
                    <span className="text-secondary">Vol: ${formatVolume(m.ticker?.quoteVolume24h ?? 0)}</span>
                    <button className={styles.miniTradeBtn}>Trade</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
