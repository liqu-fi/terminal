import { describe, it, expect, beforeEach } from 'vitest';
import { useWatchlistStore, selectFilteredSymbols } from './watchlistStore';

describe('WatchlistStore', () => {
  beforeEach(() => {
    // Reset store state
    useWatchlistStore.setState({
      symbols: [
        { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
        { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
        { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
      ],
      favorites: ['BTCUSDT'],
      pinned: [],
      selectedSymbol: 'BTCUSDT',
      searchQuery: '',
      showFavoritesOnly: false,
    });
  });

  describe('symbol selection', () => {
    it('should select a symbol', () => {
      const { setSelectedSymbol } = useWatchlistStore.getState();
      setSelectedSymbol('ETHUSDT');
      expect(useWatchlistStore.getState().selectedSymbol).toBe('ETHUSDT');
    });
  });

  describe('favorites', () => {
    it('should toggle favorite', () => {
      const { toggleFavorite } = useWatchlistStore.getState();
      
      // Add to favorites
      toggleFavorite('ETHUSDT');
      expect(useWatchlistStore.getState().favorites).toContain('ETHUSDT');
      
      // Remove from favorites
      toggleFavorite('ETHUSDT');
      expect(useWatchlistStore.getState().favorites).not.toContain('ETHUSDT');
    });
  });

  describe('pinned', () => {
    it('should toggle pinned', () => {
      const { togglePinned } = useWatchlistStore.getState();
      
      togglePinned('ETHUSDT');
      expect(useWatchlistStore.getState().pinned).toContain('ETHUSDT');
      
      togglePinned('ETHUSDT');
      expect(useWatchlistStore.getState().pinned).not.toContain('ETHUSDT');
    });
  });

  describe('search filtering', () => {
    it('should filter symbols by search query', () => {
      const { setSearchQuery } = useWatchlistStore.getState();
      setSearchQuery('BTC');
      
      const filtered = selectFilteredSymbols(useWatchlistStore.getState());
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.symbol).toBe('BTCUSDT');
    });

    it('should be case insensitive', () => {
      const { setSearchQuery } = useWatchlistStore.getState();
      setSearchQuery('eth');
      
      const filtered = selectFilteredSymbols(useWatchlistStore.getState());
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.symbol).toBe('ETHUSDT');
    });
  });

  describe('favorites only filter', () => {
    it('should show only favorites when enabled', () => {
      const { setShowFavoritesOnly } = useWatchlistStore.getState();
      setShowFavoritesOnly(true);
      
      const filtered = selectFilteredSymbols(useWatchlistStore.getState());
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.symbol).toBe('BTCUSDT');
    });
  });

  describe('pinned sorting', () => {
    it('should sort pinned symbols first', () => {
      const { togglePinned } = useWatchlistStore.getState();
      togglePinned('BNBUSDT');
      
      const filtered = selectFilteredSymbols(useWatchlistStore.getState());
      expect(filtered[0]?.symbol).toBe('BNBUSDT');
    });
  });

  describe('price updates', () => {
    it('should update symbol price', () => {
      const { updateSymbolPrice } = useWatchlistStore.getState();
      updateSymbolPrice('BTCUSDT', '50000.00', 2.5);
      
      const state = useWatchlistStore.getState();
      const btc = state.symbols.find(s => s.symbol === 'BTCUSDT');
      expect(btc?.price).toBe('50000.00');
      expect(btc?.priceChange24h).toBe(2.5);
    });
  });
});





