import { useState, useMemo } from 'react';
import { useI18n } from '../i18n';
import { Sparkline } from '../components/Chart';
import { Icon } from '../components/Icon';
import { useWatchlistStore } from '../store/watchlistStore';
import styles from './MarketsPage.module.css';

type ViewMode = 'table' | 'grid';
type SortField = 'symbol' | 'price' | 'change24h' | 'volume24h';
type SortOrder = 'asc' | 'desc';

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  sparkline: number[];
}

// Mock data - in real implementation, this would come from miniTicker WebSocket
const MOCK_MARKETS: MarketData[] = [
  { symbol: 'BTCUSDT', price: 43250.5, change24h: 2.5, volume24h: 1500000000, sparkline: [43000, 43100, 43200, 43250, 43250, 43250] },
  { symbol: 'ETHUSDT', price: 2650.8, change24h: -1.2, volume24h: 800000000, sparkline: [2680, 2670, 2660, 2655, 2650, 2650] },
  { symbol: 'BNBUSDT', price: 315.2, change24h: 0.8, volume24h: 200000000, sparkline: [312, 313, 314, 315, 315, 315] },
  { symbol: 'SOLUSDT', price: 98.5, change24h: 3.5, volume24h: 500000000, sparkline: [95, 96, 97, 98, 98.5, 98.5] },
  { symbol: 'XRPUSDT', price: 0.62, change24h: -0.5, volume24h: 300000000, sparkline: [0.63, 0.625, 0.62, 0.62, 0.62, 0.62] },
];

export function MarketsPage() {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [quoteFilter, setQuoteFilter] = useState<string>('ALL');
  
  const toggleFavorite = useWatchlistStore((state) => state.toggleFavorite);
  const addSymbol = useWatchlistStore((state) => state.addSymbol);
  const symbols = useWatchlistStore((state) => state.symbols);
  const favorites = useWatchlistStore((state) => state.favorites);

  const filteredAndSorted = useMemo(() => {
    let filtered = MOCK_MARKETS.filter(m => {
      const matchesSearch = m.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesQuote = quoteFilter === 'ALL' || m.symbol.endsWith(quoteFilter);
      return matchesSearch && matchesQuote;
    });

    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'change24h':
          aVal = a.change24h;
          bVal = b.change24h;
          break;
        case 'volume24h':
          aVal = a.volume24h;
          bVal = b.volume24h;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortOrder === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [searchTerm, sortField, sortOrder, quoteFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const isFavorite = (symbol: string) => {
    return favorites.includes(symbol);
  };

  const handleToggleFavorite = (symbol: string) => {
    // 如果交易对不在 watchlist 中，先添加
    if (!symbols.find(s => s.symbol === symbol)) {
      const parts = symbol.replace('USDT', '').replace('BTC', '').replace('ETH', '');
      addSymbol({
        symbol,
        baseAsset: parts,
        quoteAsset: symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('BTC') ? 'BTC' : 'ETH',
      });
    }
    toggleFavorite(symbol);
  };

  return (
    <div className={styles.container}>
      <div className={`card ${styles.content}`}>
        <div className="card-header">
          <span>{t.markets?.title || 'Markets'}</span>
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'table' ? styles.active : ''}`}
                onClick={() => setViewMode('table')}
                title={t.markets?.tableView || 'Table View'}
              >
                <Icon name="clipboard-list" size="sm" />
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
                title={t.markets?.gridView || 'Grid View'}
              >
                <Icon name="bar-chart-3" size="sm" />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.searchBar}>
            <Icon name="search" size="sm" className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t.markets?.searchPlaceholder || 'Search symbols...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.quoteFilter}>
            {['ALL', 'USDT', 'BTC'].map((quote) => (
              <button
                key={quote}
                className={`${styles.quoteBtn} ${quoteFilter === quote ? styles.active : ''}`}
                onClick={() => setQuoteFilter(quote)}
              >
                {quote}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <button className={styles.sortBtn} onClick={() => handleSort('symbol')}>
                      {t.markets?.symbol || 'Symbol'}
                      {sortField === 'symbol' && (
                        <Icon name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size="xs" />
                      )}
                    </button>
                  </th>
                  <th>
                    <button className={styles.sortBtn} onClick={() => handleSort('price')}>
                      {t.markets?.price || 'Price'}
                      {sortField === 'price' && (
                        <Icon name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size="xs" />
                      )}
                    </button>
                  </th>
                  <th>
                    <button className={styles.sortBtn} onClick={() => handleSort('change24h')}>
                      {t.markets?.change24h || '24h %'}
                      {sortField === 'change24h' && (
                        <Icon name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size="xs" />
                      )}
                    </button>
                  </th>
                  <th>
                    <button className={styles.sortBtn} onClick={() => handleSort('volume24h')}>
                      {t.markets?.volume24h || '24h Vol'}
                      {sortField === 'volume24h' && (
                        <Icon name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size="xs" />
                      )}
                    </button>
                  </th>
                  <th>{t.markets?.chart || 'Chart'}</th>
                  <th>{t.markets?.actions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((market) => (
                  <tr key={market.symbol}>
                    <td className={styles.symbolCell}>{market.symbol}</td>
                    <td className="tabular-nums">{market.price.toFixed(2)}</td>
                    <td className={`tabular-nums ${market.change24h >= 0 ? 'price-up' : 'price-down'}`}>
                      {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                    </td>
                    <td className="tabular-nums">{market.volume24h.toLocaleString()}</td>
                    <td>
                      <Sparkline data={market.sparkline} />
                    </td>
                    <td>
                      <button
                        className={styles.favoriteBtn}
                        onClick={() => handleToggleFavorite(market.symbol)}
                        title={isFavorite(market.symbol) ? t.watchlist?.removeFromFavorites : t.watchlist?.addToFavorites}
                      >
                        <Icon 
                          name={isFavorite(market.symbol) ? 'star-filled' : 'star'} 
                          size="sm"
                          style={{ color: isFavorite(market.symbol) ? 'var(--color-warning)' : undefined }}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.gridContainer}>
            {filteredAndSorted.map((market) => (
              <div key={market.symbol} className={styles.gridCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardSymbol}>{market.symbol}</span>
                  <button
                    className={styles.favoriteBtn}
                    onClick={() => handleToggleFavorite(market.symbol)}
                  >
                    <Icon 
                      name={isFavorite(market.symbol) ? 'star-filled' : 'star'} 
                      size="sm"
                      style={{ color: isFavorite(market.symbol) ? 'var(--color-warning)' : undefined }}
                    />
                  </button>
                </div>
                <div className={styles.cardPrice}>
                  <span className="tabular-nums">{market.price.toFixed(2)}</span>
                  <span className={`tabular-nums ${market.change24h >= 0 ? 'price-up' : 'price-down'}`}>
                    {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.cardChart}>
                  <Sparkline data={market.sparkline} width={120} height={40} />
                </div>
                <div className={styles.cardVolume}>
                  <span className={styles.volumeLabel}>{t.markets?.volume24h || '24h Vol'}:</span>
                  <span className="tabular-nums">{market.volume24h.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
