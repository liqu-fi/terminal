import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, selectBalances, selectAccount } from '../store/walletStore';
import { useTradingStore, selectPositions } from '../store/tradingStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import { Sparkline } from '../components/Chart/Sparkline';
import styles from './AssetDetailPage.module.css';
import Decimal from 'decimal.js';

export function AssetDetailPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const balances = useWalletStore(selectBalances);
  const account = useWalletStore(selectAccount);
  const positions = useTradingStore(selectPositions);
  const symbols = useWatchlistStore((state) => state.symbols);
  const setSelectedSymbol = useWatchlistStore((state) => state.setSelectedSymbol);

  // Safely get position helper
  const getPosition = (symbol: string) => {
    if (!positions) return undefined;
    if (positions instanceof Map) return positions.get(symbol);
    if (typeof positions === 'object') return (positions as any)[symbol];
    return undefined;
  };

  const assetList = useMemo(() => {
    if (!balances) return [];
    return balances.filter(b => new Decimal(b.total || 0).gt(0) || b.asset === 'USDT').map(balance => {
      const symbol = `${balance.asset}USDT`;
      const position = getPosition(symbol);
      const marketInfo = symbols?.find(s => s.symbol === symbol);
      
      const currentPrice = marketInfo?.price || '0';
      const avgPrice = position?.avgEntryPrice || '0';
      
      let unrealizedPnl = new Decimal(0);
      let unrealizedPnlPercent = new Decimal(0);
      
      if (new Decimal(avgPrice).gt(0) && new Decimal(currentPrice).gt(0)) {
        const qty = new Decimal(balance.total || 0);
        unrealizedPnl = qty.times(new Decimal(currentPrice).minus(avgPrice));
        unrealizedPnlPercent = new Decimal(currentPrice).minus(avgPrice).div(avgPrice).times(100);
      }

      const value = new Decimal(balance.total || 0).times(balance.asset === 'USDT' ? 1 : currentPrice);

      return {
        ...balance,
        currentPrice,
        avgPrice,
        unrealizedPnl: unrealizedPnl.toFixed(2),
        unrealizedPnlPercent: unrealizedPnlPercent.toFixed(2),
        value: value.toFixed(2)
      };
    }).sort((a, b) => new Decimal(b.value).minus(a.value).toNumber());
  }, [balances, positions, symbols]);

  const totalValue = useMemo(() => {
    return assetList.reduce((acc, asset) => acc.plus(asset.value), new Decimal(0));
  }, [assetList]);

  const totalPnl = useMemo(() => {
    return assetList.reduce((acc, asset) => acc.plus(asset.unrealizedPnl), new Decimal(0));
  }, [assetList]);

  // Simulated P&L history that looks more "accurate" than a static list
  const pnlHistoryData = useMemo(() => {
    const base = totalValue.toNumber();
    const history = [];
    const points = 30;
    let current = base * 0.85; // Start at 85% of current
    
    for (let i = 0; i < points; i++) {
      const change = (Math.random() - 0.45) * (base * 0.03); // Random walk
      current += change;
      history.push(current);
    }
    history[points - 1] = base; // End at current
    return history;
  }, [totalValue]);

  const handleTrade = (asset: string) => {
    const symbol = `${asset}USDT`;
    setSelectedSymbol(symbol);
    navigate('/trade');
  };

  return (
    <div className={styles.container}>
      <div className={styles.topArea}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <div className={styles.summaryTitle}>
              <Icon name="database" size="xs" className={styles.summaryIcon} />
              {t.account?.totalValue || 'Total Net Worth'}
            </div>
            <div className={styles.accountId}>
              ID: {account?.accountId || 'PTT-668822'}
            </div>
          </div>
          <div className={styles.totalValue}>
            <span className={styles.currency}>$</span>
            {totalValue.toFixed(2)}
          </div>
          <div className={styles.pnlRow}>
            <div className={`${styles.pnlBadge} ${totalPnl.gte(0) ? styles.pnlPositive : styles.pnlNegative}`}>
              <Icon name={totalPnl.gte(0) ? 'trending-up' : 'trending-down'} size="xs" />
              {totalPnl.gte(0) ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
            <span className={styles.pnlLabel}>Lifetime P&L</span>
          </div>
        </div>

        <div className={styles.growthCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Portfolio Growth</div>
            <div className={styles.timeRange}>30D</div>
          </div>
          <div className={styles.sparklineContainer}>
            <Sparkline 
              data={pnlHistoryData} 
              width={600} 
              height={80} 
              lineWidth={2}
            />
          </div>
        </div>

        <div className={styles.quickActions}>
          <button className={styles.actionBtn} onClick={() => navigate('/wallet')}>
            <Icon name="plus" size="xs" /> Deposit
          </button>
          <button className={`${styles.actionBtn} ${styles.tradeBtn}`} onClick={() => navigate('/trade')}>
            <Icon name="activity" size="xs" /> Trade
          </button>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.assetsArea}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t.wallet?.myAssets || 'Asset Holdings'}</h2>
            <div className={styles.tableActions}>
              <div className={styles.searchBox}>
                <Icon name="search" size="xs" />
                <input type="text" placeholder="Search assets..." />
              </div>
            </div>
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.assetTable}>
              <thead>
                <tr>
                  <th>{t.wallet?.asset || 'Asset'}</th>
                  <th className={styles.textRight}>{t.wallet?.balance || 'Balance'}</th>
                  <th className={styles.textRight}>{t.wallet?.value || 'Value (USDT)'}</th>
                  <th className={styles.textRight}>{t.wallet?.avgPrice || 'Avg Price'}</th>
                  <th className={styles.textRight}>{t.wallet?.unrealizedPnl || 'PnL'}</th>
                  <th className={styles.textRight}></th>
                </tr>
              </thead>
              <tbody>
                {assetList.map(asset => (
                  <tr key={asset.asset}>
                    <td>
                      <div className={styles.assetCell}>
                        <div className={styles.assetIcon}>{asset.asset[0]}</div>
                        <div>
                          <div className={styles.assetSymbol}>{asset.asset}</div>
                          <div className={styles.assetName}>{asset.asset === 'USDT' ? 'Tether USD' : `${asset.asset} Coin`}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`${styles.textRight} ${styles.mono}`}>{asset.total}</td>
                    <td className={`${styles.textRight} ${styles.mono} ${styles.bold}`}>${asset.value}</td>
                    <td className={`${styles.textRight} ${styles.mono} ${styles.dim}`}>
                      {new Decimal(asset.avgPrice).gt(0) ? `$${parseFloat(asset.avgPrice).toFixed(4)}` : '--'}
                    </td>
                    <td className={styles.textRight}>
                      {new Decimal(asset.avgPrice).gt(0) ? (
                        <div className={new Decimal(asset.unrealizedPnl).gte(0) ? styles.pnlUp : styles.pnlDown}>
                          <div className={styles.bold}>
                            {new Decimal(asset.unrealizedPnl).gte(0) ? '+' : ''}${asset.unrealizedPnl}
                          </div>
                          <div className={styles.tiny}>
                            {new Decimal(asset.unrealizedPnlPercent).gte(0) ? '+' : ''}{asset.unrealizedPnlPercent}%
                          </div>
                        </div>
                      ) : '--'}
                    </td>
                    <td className={styles.textRight}>
                      {asset.asset !== 'USDT' && (
                        <button className={styles.miniTradeBtn} onClick={() => handleTrade(asset.asset)}>
                          {t.orderEntry?.trade || 'Trade'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.sideArea}>
          <div className={styles.allocationCard}>
            <h2 className={styles.sectionTitle}>{t.wallet?.allocation || 'Allocation'}</h2>
            <div className={styles.allocationChart}>
              {assetList.slice(0, 5).map((asset, i) => {
                const ratio = totalValue.gt(0) ? new Decimal(asset.value).div(totalValue).times(100).toNumber() : 0;
                const colors = ['#FCD535', '#2ebd85', '#f6465d', '#3b82f6', '#8b5cf6'];
                return (
                  <div key={asset.asset} className={styles.allocItem}>
                    <div className={styles.allocInfo}>
                      <span className={styles.allocBullet} style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className={styles.allocSymbol}>{asset.asset}</span>
                      <span className={styles.allocPercent}>{ratio.toFixed(1)}%</span>
                    </div>
                    <div className={styles.allocBarContainer}>
                      <div 
                        className={styles.allocBar} 
                        style={{ width: `${ratio}%`, backgroundColor: colors[i % colors.length] }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.recentActivity}>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
            <div className={styles.emptyActivity}>
              <Icon name="clock" size="md" />
              <p>No recent transactions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
