import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { Positions } from '../Positions';
import { OpenOrders } from '../OpenOrders';
import { AutomationPanel } from '../AutomationPanel';
import { OrderBook } from '../OrderBook';
import { useTradingStore } from '../../store/tradingStore';
import { Icon } from '../Icon';
import styles from './BottomTabs.module.css';

type TabType = 'positions' | 'orders' | 'automation' | 'orderbook';

interface BottomTabsProps {
  onPriceClick?: (price: string, side?: 'buy' | 'sell') => void;
}

export function BottomTabs({ onPriceClick }: BottomTabsProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const openOrdersCount = useTradingStore((state) => state.getOpenOrders().length);
  const positionsCount = Array.from(useTradingStore((state) => state.positions.entries())).filter(([_, pos]) => parseFloat(pos.quantity) > 0).length;

  const handlePriceClick = useCallback((price: string, side?: 'buy' | 'sell') => {
    onPriceClick?.(price, side);
  }, [onPriceClick]);

  return (
    <div className={styles.container}>
      <div className={styles.tabsHeader}>
        <button 
          className={`${styles.tab} ${activeTab === 'positions' ? styles.active : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          <Icon name="activity" size="xs" />
          <span>{t.positions.title}</span>
          {positionsCount > 0 && <span className={styles.tabCount}>{positionsCount}</span>}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Icon name="list" size="xs" />
          <span>{t.openOrders.title}</span>
          {openOrdersCount > 0 && <span className={styles.tabCount}>{openOrdersCount}</span>}
        </button>
        <button 
          className={`${styles.tab} ${styles.orderBookTab} ${activeTab === 'orderbook' ? styles.active : ''}`}
          onClick={() => setActiveTab('orderbook')}
        >
          <Icon name="layers" size="xs" />
          <span>{t.orderBook?.title || 'Order Book'}</span>
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'automation' ? styles.active : ''}`}
          onClick={() => setActiveTab('automation')}
        >
          <Icon name="zap" size="xs" />
          <span>{t.automation?.panelTitle || 'Automation'}</span>
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'positions' && (
          <div className={styles.tabPanel}>
            <Positions />
          </div>
        )}
        {activeTab === 'orders' && (
          <div className={styles.tabPanel}>
            <OpenOrders />
          </div>
        )}
        {activeTab === 'orderbook' && (
          <div className={styles.tabPanel}>
            <OrderBook onPriceClick={handlePriceClick} embedded />
          </div>
        )}
        {activeTab === 'automation' && (
          <div className={styles.tabPanel}>
            <AutomationPanel isEmbedded />
          </div>
        )}
      </div>
    </div>
  );
}

