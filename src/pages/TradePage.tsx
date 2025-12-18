import { useEffect, useState, useCallback } from 'react';
import { OrderBook } from '../components/OrderBook';
import { MetricsPanel } from '../components/MetricsPanel';
import { RecentTrades } from '../components/RecentTrades';
import { OrderEntry } from '../components/OrderEntry';
import { OpenOrders } from '../components/OpenOrders';
import { Positions } from '../components/Positions';
import { RiskRibbon } from '../components/RiskRibbon';
import { DepthChart } from '../components/DepthChart';
import { PriceChart } from '../components/Chart';
import { Watchlist } from '../components/Watchlist';
import { useMarketStore, selectOrderBook } from '../store/marketStore';
import { useTradingStore } from '../store/tradingStore';
import { useWatchlistStore, selectSelectedSymbol } from '../store/watchlistStore';
import styles from './TradePage.module.css';

export function TradePage() {
  const orderBook = useMarketStore(selectOrderBook);
  const subscribe = useMarketStore((state) => state.subscribe);
  const unsubscribe = useMarketStore((state) => state.unsubscribe);
  const updateOrderBookForMatching = useTradingStore((state) => state.updateOrderBookForMatching);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  
  const [selectedPrice, setSelectedPrice] = useState<string | undefined>();
  const [selectedSide, setSelectedSide] = useState<'buy' | 'sell' | undefined>();

  const handlePriceClick = useCallback((price: string, side: 'buy' | 'sell') => {
    setSelectedPrice(price);
    setSelectedSide(side);
  }, []);

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

  return (
    <div className={styles.container}>
      <div className={styles.watchlistSidebar}>
        <Watchlist onSymbolChange={handleSymbolChange} />
      </div>

      <div className={styles.leftColumn}>
        <OrderBook onPriceClick={handlePriceClick} />
        <DepthChart />
      </div>

      <div className={styles.centerColumn}>
        <PriceChart />
        <MetricsPanel />
        <RecentTrades />
        <OpenOrders />
      </div>

      <div className={styles.rightColumn}>
        <RiskRibbon />
        <OrderEntry priceFromOrderBook={selectedPrice} sideFromOrderBook={selectedSide} />
        <Positions />
      </div>
    </div>
  );
}

