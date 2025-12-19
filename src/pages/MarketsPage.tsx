import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Sparkline } from '../components/Chart';
import { Icon } from '../components/Icon';
import { useWatchlistStore } from '../store/watchlistStore';
import {
  fetchAllTickers,
  fetchSparkline,
  calculateIndicators,
  formatVolume,
  formatPrice,
  parseSymbol,
  POPULAR_SYMBOLS,
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<keyof MarketTicker>('quoteVolume24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { favorites, toggleFavorite, addSymbol } = useWatchlistStore();

  const loadData = useCallback(async () => {
    try {
      const tickers = await fetchAllTickers();
      const initialMarkets: MarketData[] = tickers.map(t => ({
        symbol: t.symbol,
        ticker: t,
        sparkline: null,
        indicators: null,
      }));
      setMarkets(initialMarkets);
      setLoading(false);

      // Async load sparklines and indicators in small batches to prevent blocking
      for (const ticker of tickers) {
        fetchSparkline(ticker.symbol).then(s => {
          setMarkets(prev => prev.map(m => m.symbol === ticker.symbol ? { ...m, sparkline: s } : m));
        });
        calculateIndicators(ticker.symbol).then(i => {
          setMarkets(prev => prev.map(m => m.symbol === ticker.symbol ? { ...m, indicators: i } : m));
        });
      }
    } catch (err) {
      console.error('Market load error:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, [loadData]);

  const filteredMarkets = useMemo(() => {
    return markets.filter(m => {
      const matchesSearch = m.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = category === 'All' || category === 'Favorites' ? true : m.symbol.includes(category);
      const isFav = favorites.includes(m.symbol);
      if (category === 'Favorites' && !isFav) return false;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      if (!a.ticker || !b.ticker) return 0;
      const vA = a.ticker[sortField] as number;
      const vB = b.ticker[sortField] as number;
      return sortOrder === 'desc' ? vB - vA : vA - vB;
    });
  }, [markets, searchTerm, category, favorites, sortField, sortOrder]);

  const stats = useMemo(() => {
    const active = markets.filter(m => m.ticker);
    const up = active.filter(m => (m.ticker?.priceChangePercent ?? 0) > 0).length;
    const down = active.length - up;
    const totalVol = active.reduce((acc, m) => acc + (m.ticker?.quoteVolume24h ?? 0), 0);
    return { up, down, totalVol };
  }, [markets]);

  const handleSelect = (symbol: string) => {
    const { base, quote } = parseSymbol(symbol);
    addSymbol({ symbol, baseAsset: base, quoteAsset: quote });
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
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Market Breadth</span>
          <div className={styles.breadthBar}>
            <div className={styles.breadthUp} style={{ width: `${(stats.up / (stats.up + stats.down || 1)) * 100}%` }} />
          </div>
          <div className={styles.statValueRow}>
            <span className="price-up">{stats.up} UP</span>
            <span className="price-down">{stats.down} DOWN</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>24h Aggregate Volume</span>
          <span className={styles.statValue}>${formatVolume(stats.totalVol)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Market Status</span>
          <div className={styles.statusIndicator}>
            <div className="dot dot-live" />
            <span>REAL-TIME FEED ACTIVE</span>
          </div>
        </div>
        <div className={styles.statCard} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={() => navigate('/assets')}>
            <Icon name="layout" size="sm" />
            {t.wallet?.overview || 'Details'}
          </button>
        </div>
      </div>

      <div className={`card ${styles.mainCard}`}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {['All', 'Favorites', 'Main', 'DeFi', 'AI', 'Meme'].map(cat => (
              <button 
                key={cat}
                className={`${styles.tab} ${category === cat ? styles.activeTab : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat === 'Favorites' && <Icon name="star" size="xs" />}
                {cat}
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
            <button className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.activeMode : ''}`} onClick={() => setViewMode('table')}>
              <Icon name="clipboard-list" size="sm" />
            </button>
            <button className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.activeMode : ''}`} onClick={() => setViewMode('grid')}>
              <Icon name="bar-chart-3" size="sm" />
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
                        <Sparkline data={m.sparkline.prices} height={24} width={100} />
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
                    {m.sparkline && <Sparkline data={m.sparkline.prices} height={40} width={180} />}
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
