import { useCallback, useMemo, useRef } from 'react';
import { 
  useWatchlistStore, 
  selectFilteredSymbols, 
  selectFavorites, 
  selectPinned,
  selectSelectedSymbol,
  selectSearchQuery,
  selectShowFavoritesOnly,
  type SymbolInfo 
} from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { Sparkline } from '../Chart';
import styles from './Watchlist.module.css';

// SVG 图标组件
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface WatchlistItemProps {
  symbol: SymbolInfo;
  isSelected: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
}

function WatchlistItem({ 
  symbol, 
  isSelected, 
  isFavorite,
  isPinned,
  onSelect, 
  onToggleFavorite,
  onTogglePinned,
}: WatchlistItemProps) {
  const { t } = useI18n();
  const priceChangeClass = useMemo(() => {
    if (!symbol.priceChange24h) return '';
    return symbol.priceChange24h > 0 ? styles.priceUp : symbol.priceChange24h < 0 ? styles.priceDown : '';
  }, [symbol.priceChange24h]);

  return (
    <div 
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.itemLeft}>
        <button 
          className={`${styles.favoriteBtn} ${isFavorite ? styles.active : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={t.watchlist?.toggleFavorite || 'Toggle favorite'}
        >
          <StarIcon filled={isFavorite} />
        </button>
        <div className={styles.symbolInfo}>
          <span className={styles.symbolName}>
            {isPinned && <PinIcon filled={true} />}
            {symbol.baseAsset}
          </span>
          <span className={styles.symbolQuote}>/{symbol.quoteAsset}</span>
        </div>
      </div>
      <div className={styles.itemRight}>
        {symbol.price ? (
          <>
            <div className={styles.priceRow}>
              <span className={`${styles.price} tabular-nums`}>
                {parseFloat(symbol.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
              </span>
              {symbol.priceChange24h !== undefined && (
                <span className={`${styles.priceChange} ${priceChangeClass} tabular-nums`}>
                  {symbol.priceChange24h > 0 ? '+' : ''}{symbol.priceChange24h.toFixed(2)}%
                </span>
              )}
            </div>
            {symbol.sparkline && symbol.sparkline.length > 0 && (
              <div className={styles.sparklineContainer}>
                <Sparkline data={symbol.sparkline} width={60} height={20} />
              </div>
            )}
          </>
        ) : (
          <span className={styles.noPrice}>--</span>
        )}
      </div>
    </div>
  );
}

interface WatchlistProps {
  onSymbolChange?: (symbol: string) => void;
}

export function Watchlist({ onSymbolChange }: WatchlistProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const filteredSymbols = useWatchlistStore(selectFilteredSymbols);
  const favorites = useWatchlistStore(selectFavorites);
  const pinned = useWatchlistStore(selectPinned);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const searchQuery = useWatchlistStore(selectSearchQuery);
  const showFavoritesOnly = useWatchlistStore(selectShowFavoritesOnly);
  
  const {
    setSelectedSymbol,
    setSearchQuery,
    setShowFavoritesOnly,
    toggleFavorite,
    togglePinned,
  } = useWatchlistStore();

  const handleSymbolSelect = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    onSymbolChange?.(symbol);
  }, [setSelectedSymbol, onSymbolChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    inputRef.current?.focus();
  }, [setSearchQuery]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredSymbols.length === 0) return;
    
    const currentIndex = filteredSymbols.findIndex(s => s.symbol === selectedSymbol);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < filteredSymbols.length - 1 ? currentIndex + 1 : 0;
      const nextSymbol = filteredSymbols[nextIndex];
      if (nextSymbol) handleSymbolSelect(nextSymbol.symbol);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredSymbols.length - 1;
      const prevSymbol = filteredSymbols[prevIndex];
      if (prevSymbol) handleSymbolSelect(prevSymbol.symbol);
    } else if (e.key === 'Enter' && currentIndex >= 0) {
      // Enter 确认当前选中
      onSymbolChange?.(selectedSymbol);
    }
  }, [filteredSymbols, selectedSymbol, handleSymbolSelect, onSymbolChange]);

  return (
    <div className={`card ${styles.container}`}>
      <div className="card-header">
        <span>{t.watchlist?.title || 'Watchlist'}</span>
        <button 
          className={`${styles.filterBtn} ${showFavoritesOnly ? styles.active : ''}`}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          title={showFavoritesOnly ? t.watchlist?.showAll : t.watchlist?.showFavorites}
        >
          <StarIcon filled={showFavoritesOnly} />
        </button>
      </div>
      
      {/* 搜索框 */}
      <div className={styles.searchWrapper}>
        <div className={styles.searchIcon}>
          <SearchIcon />
        </div>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder={t.watchlist?.searchPlaceholder || 'Search symbol...'}
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
        />
        {searchQuery && (
          <button className={styles.clearBtn} onClick={handleClearSearch}>
            <ClearIcon />
          </button>
        )}
      </div>

      {/* 列表 */}
      <div className={styles.list}>
        {filteredSymbols.length > 0 ? (
          filteredSymbols.map((symbol) => (
            <WatchlistItem
              key={symbol.symbol}
              symbol={symbol}
              isSelected={selectedSymbol === symbol.symbol}
              isFavorite={favorites.includes(symbol.symbol)}
              isPinned={pinned.includes(symbol.symbol)}
              onSelect={() => handleSymbolSelect(symbol.symbol)}
              onToggleFavorite={() => toggleFavorite(symbol.symbol)}
              onTogglePinned={() => togglePinned(symbol.symbol)}
            />
          ))
        ) : (
          <div className={styles.empty}>
            {searchQuery 
              ? (t.watchlist?.noResults || 'No matching symbols')
              : (t.watchlist?.empty || 'No symbols in watchlist')}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className={styles.footer}>
        <span className={styles.count}>
          {filteredSymbols.length} {t.watchlist?.symbols || 'symbols'}
        </span>
      </div>
    </div>
  );
}

