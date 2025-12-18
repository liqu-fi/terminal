import { useState, useEffect } from 'react';
import { useMarketStore, selectConnectionStatus } from '../../store/marketStore';
import { useI18n } from '../../i18n';
import styles from './SymbolSelector.module.css';

const POPULAR_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
];

export function SymbolSelector() {
  const { t } = useI18n();
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [inputValue, setInputValue] = useState('BTCUSDT');
  const connectionStatus = useMarketStore(selectConnectionStatus);
  const subscribe = useMarketStore((state) => state.subscribe);
  const unsubscribe = useMarketStore((state) => state.unsubscribe);

  const isConnected = connectionStatus.state === 'connected';
  const isConnecting = connectionStatus.state === 'connecting' || connectionStatus.state === 'reconnecting';

  const handleConnect = () => {
    const normalizedSymbol = inputValue.toUpperCase().trim();
    if (normalizedSymbol) {
      setSymbol(normalizedSymbol);
      subscribe(normalizedSymbol);
    }
  };

  const handleDisconnect = () => {
    unsubscribe();
  };

  const handleQuickSelect = (sym: string) => {
    setInputValue(sym);
    setSymbol(sym);
    subscribe(sym);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    subscribe(symbol);
    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.inputGroup}>
        <input
          type="text"
          className={styles.input}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder={t.symbolSelector?.placeholder || 'Symbol (e.g., BTCUSDT)'}
          disabled={isConnecting}
        />
        
        {!isConnected ? (
          <button
            className={`btn btn-primary ${styles.connectBtn}`}
            onClick={handleConnect}
            disabled={isConnecting || !inputValue.trim()}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        ) : (
          <button
            className={`btn btn-secondary ${styles.connectBtn}`}
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        )}
      </div>

      <div className={styles.quickSelect}>
        {POPULAR_SYMBOLS.map((sym) => (
          <button
            key={sym}
            className={`${styles.quickBtn} ${sym === symbol && isConnected ? styles.active : ''}`}
            onClick={() => handleQuickSelect(sym)}
            disabled={isConnecting}
          >
            {sym.replace('USDT', '')}
          </button>
        ))}
      </div>
    </div>
  );
}

