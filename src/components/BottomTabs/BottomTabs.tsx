import { useState, useCallback } from 'react';
import { Positions } from '../Positions';
import { OpenOrders } from '../OpenOrders';
import { OrderBook } from '../OrderBook';
import { useTradingStore } from '../../store/tradingStore';
import { Icon } from '../Icon';
import styles from './BottomTabs.module.css';

type LeftTab = 'positions' | 'orders' | 'orderbook';

interface BottomTabsProps {
  onPriceClick?: (price: string, side?: 'buy' | 'sell') => void;
}

export function BottomTabs({ onPriceClick }: BottomTabsProps) {
  const [leftTab, setLeftTab] = useState<LeftTab>('positions');

  const openOrdersCount = useTradingStore((state) => state.getOpenOrders().length);
  const positionsCount = Array.from(useTradingStore((state) => state.positions).entries()).filter(([_, pos]) => parseFloat(pos.quantity) > 0).length;
  const handlePriceClick = useCallback((price: string, side?: 'buy' | 'sell') => {
    onPriceClick?.(price, side);
  }, [onPriceClick]);

  return (
    <div className={styles.container}>
      <div className={styles.columns}>
        {/* Left Column - Positions/Orders */}
        <div className={styles.leftColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${leftTab === 'positions' ? styles.active : ''}`}
                onClick={() => setLeftTab('positions')}
              >
                <Icon name="briefcase" size="xs" />
                <span>Positions</span>
                {positionsCount > 0 && <span className={styles.badge}>{positionsCount}</span>}
              </button>
              <button
                className={`${styles.tab} ${leftTab === 'orders' ? styles.active : ''}`}
                onClick={() => setLeftTab('orders')}
              >
                <Icon name="list" size="xs" />
                <span>Orders</span>
                {openOrdersCount > 0 && <span className={styles.badge}>{openOrdersCount}</span>}
              </button>
              <button
                className={`${styles.tab} ${styles.orderbookTab} ${leftTab === 'orderbook' ? styles.active : ''}`}
                onClick={() => setLeftTab('orderbook')}
              >
                <Icon name="bar-chart-2" size="xs" />
                <span>Book</span>
              </button>
            </div>
          </div>
          <div className={styles.columnContent}>
            {leftTab === 'positions' && <Positions />}
            {leftTab === 'orders' && <OpenOrders />}
            {leftTab === 'orderbook' && <OrderBook onPriceClick={handlePriceClick} embedded />}
          </div>
        </div>
      </div>
    </div>
  );
}
