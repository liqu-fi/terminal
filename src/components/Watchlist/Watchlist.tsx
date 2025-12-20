import { useCallback, useMemo, useRef, useEffect } from 'react';
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
import { useTradingStore, selectPositions } from '../../store/tradingStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './Watchlist.module.css';
import Decimal from 'decimal.js';

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
  position?: { quantity: string; avgEntryPrice: string; unrealizedPnl: string };
  onSelect: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
  isCollapsed?: boolean;
}

function WatchlistItem({ 
  symbol, 
  isSelected, 
  isFavorite,
  isPinned,
  position,
  onSelect, 
  onToggleFavorite,
  onTogglePinned: _onTogglePinned,
  isCollapsed = false,
}: WatchlistItemProps) {
  const changeBadgeClass = useMemo(() => {
    if (!symbol || symbol.priceChange24h === undefined) return '';
    return symbol.priceChange24h > 0 ? styles.changeUp : symbol.priceChange24h < 0 ? styles.changeDown : '';
  }, [symbol]);

  const pnlPercent = useMemo(() => {
    if (!position || !symbol || !symbol.price) return null;
    try {
      const currentPrice = new Decimal(symbol.price);
      const avgPrice = new Decimal(position.avgEntryPrice || 0);
      if (avgPrice.lte(0) || currentPrice.lte(0)) return null;
      return currentPrice.minus(avgPrice).div(avgPrice).times(100);
    } catch {
      return null;
    }
  }, [position, symbol]);

  const hasPrice = symbol.price && parseFloat(symbol.price) > 0;

  if (!symbol) return null;

  if (isCollapsed) {
    return (
      <div 
        className={`${styles.item} ${styles.itemCollapsed} ${isSelected ? styles.selected : ''}`}
        onClick={onSelect}
        title={`${symbol.baseAsset}/${symbol.quoteAsset}`}
      >
        <div className={styles.symbolIconCollapsed}>
          {symbol.baseAsset?.charAt(0)}
        </div>
        {position && parseFloat(position.quantity || '0') > 0 && (
          <div className={styles.positionIndicator} />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`${styles.item} ${isSelected ? styles.selected : ''} ${isCollapsed ? styles.itemCollapsed : ''}`}
      onClick={onSelect}
    >
      <div className={styles.itemLeft}>
        {!isCollapsed && (
          <button 
            className={`${styles.favoriteBtn} ${isFavorite ? styles.active : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          >
            <StarIcon filled={isFavorite} />
          </button>
        )}
        <div className={styles.symbolInfo}>
          <div className={styles.symbolHeader}>
            {isCollapsed ? (
              <div className={styles.symbolIconCollapsed} title={`${symbol.baseAsset}/${symbol.quoteAsset}`}>
                {symbol.baseAsset?.charAt(0)}
              </div>
            ) : (
              <div className={styles.symbolName}>
                {isPinned && <PinIcon filled={true} />}
                {symbol.baseAsset || '--'}
              </div>
            )}
            {!isCollapsed && <div className={styles.symbolQuote}>/{symbol.quoteAsset || 'USDT'}</div>}
          </div>
          {position && parseFloat(position.quantity || '0') > 0 && (
            isCollapsed ? (
              <div className={styles.positionIndicator} />
            ) : (
              <div className={styles.pnlRow}>
                <span className={styles.pnlLabel}>PnL:</span>
                <span className={`${styles.pnlValue} ${pnlPercent && pnlPercent.gte(0) ? styles.priceUp : styles.priceDown}`}>
                  {pnlPercent ? (pnlPercent.gte(0) ? '+' : '') : ''}{pnlPercent ? pnlPercent.toFixed(2) : '--'}%
                </span>
              </div>
            )
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className={styles.itemRight}>
          <div className={`${styles.price} tabular-nums`}>
            {hasPrice 
              ? parseFloat(symbol.price!).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
              : <span className={styles.loading}>...</span>
            }
          </div>
          {symbol.priceChange24h !== undefined ? (
            <div className={`${styles.priceChange} ${changeBadgeClass} tabular-nums`}>
              {symbol.priceChange24h > 0 ? '+' : ''}{symbol.priceChange24h.toFixed(2)}%
            </div>
          ) : (
            <div className={`${styles.priceChange} ${styles.loading} tabular-nums`}>--%</div>
          )}
        </div>
      )}
    </div>
  );
}

interface WatchlistProps {
  onSymbolChange?: (symbol: string) => void;
  isCollapsed?: boolean;
  compact?: boolean;
}

export function Watchlist({ onSymbolChange, isCollapsed = false, compact: _compact = false }: WatchlistProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const filteredSymbols = useWatchlistStore(selectFilteredSymbols);
  const favorites = useWatchlistStore(selectFavorites);
  const pinned = useWatchlistStore(selectPinned);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const searchQuery = useWatchlistStore(selectSearchQuery);
  const showFavoritesOnly = useWatchlistStore(selectShowFavoritesOnly);
  const positions = useTradingStore(selectPositions);
  const symbols = useWatchlistStore(state => state.symbols);
  const updateSymbolPrice = useWatchlistStore(state => state.updateSymbolPrice);
  
  // 获取所有 symbols 的价格数据（优化：减少请求频率）
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // 使用代理路径避免 CORS 问题
        const symbolList = symbols.map(s => s.symbol).join(',');
        const response = await fetch(`/binance-api/api/v3/ticker/24hr?symbols=[${symbolList.split(',').map(s => `"${s}"`).join(',')}]`);
        
        if (!response.ok) {
          console.warn('Watchlist fetch failed:', response.status);
          return; // 不回退到单个请求，避免触发速率限制
        }
        
        const data = await response.json();
        
        // 更新每个 symbol 的价格
        for (const ticker of data) {
          updateSymbolPrice(
            ticker.symbol, 
            ticker.lastPrice, 
            parseFloat(ticker.priceChangePercent)
          );
        }
      } catch (err) {
        console.error('Failed to fetch prices:', err);
      }
    };

    // 延迟首次请求
    const initialDelay = setTimeout(fetchPrices, 500);

    // 每 60 秒更新一次（避免速率限制）
    const interval = setInterval(fetchPrices, 60000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [symbols, updateSymbolPrice]);
  
  const getPosition = useCallback((symbol: string) => {
    if (positions instanceof Map) {
      return positions.get(symbol);
    }
    // Fallback if positions is not a Map (e.g. during hydration or if storage is corrupted)
    if (typeof positions === 'object' && positions !== null) {
      return (positions as Record<string, { quantity: string; avgEntryPrice: string; unrealizedPnl: string }>)[symbol];
    }
    return undefined;
  }, [positions]);

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
    <div className={`card ${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      {!isCollapsed && (
        <div className="card-header">
          <span>{t.watchlist?.title || 'Watchlist'}</span>
          <button 
            className={`${styles.filterBtn} ${showFavoritesOnly ? styles.active : ''}`}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            title={showFavoritesOnly ? t.watchlist?.showAll : t.watchlist?.showFavorites}
          >
            <StarIcon filled={showFavoritesOnly} />
            <span>{showFavoritesOnly ? t.watchlist?.favorites || 'Favorites Only' : t.watchlist?.all || 'All'}</span>
          </button>
        </div>
      )}
      
      {/* 搜索框 */}
      {!isCollapsed && (
        <div className={styles.searchWrapper}>
          <div className={styles.searchIcon}>
            <SearchIcon />
          </div>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder={t.watchlist?.searchPlaceholder || 'Search symbols...'}
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
      )}

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
              position={getPosition(symbol.symbol)}
              onSelect={() => handleSymbolSelect(symbol.symbol)}
              onToggleFavorite={() => toggleFavorite(symbol.symbol)}
              onTogglePinned={() => togglePinned(symbol.symbol)}
              isCollapsed={isCollapsed}
            />
          ))
        ) : (
          <div className={styles.empty}>
            {isCollapsed ? <Icon name="search" size="sm" /> : (searchQuery 
              ? (t.watchlist?.noResults || 'No matching symbols')
              : (t.watchlist?.empty || 'No symbols in watchlist'))}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      {!isCollapsed && (
        <div className={styles.footer}>
          <span className={styles.count}>
            {filteredSymbols.length} {t.watchlist?.symbols || 'symbols'}
          </span>
        </div>
      )}
    </div>
  );
}
