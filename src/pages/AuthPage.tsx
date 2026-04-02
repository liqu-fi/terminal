import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { useGatewayAuthMutation } from '@liq/react';
import { useAuthStore } from '../store/authStore';
import { Icon } from '../components/Icon';
import styles from './AuthPage.module.css';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { address, isConnected } = useAccount();
  const gatewayAuth = useGatewayAuthMutation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/trade');
    }
  }, [isAuthenticated, navigate]);

  const handleAuth = () => {
    if (!isConnected) return;
    gatewayAuth.mutate({ accountId: 0n, alreadyBookMode: true });
  };

  return (
    <div className={styles.container}>
      <div className={styles.decor}>
        <div className={styles.grid} />
      </div>
      <div className={styles.overlay} />

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Icon name="activity" size="xl" strokeWidth={3} />
          </div>
          <span className={styles.title}>LIQ TERMINAL</span>
          <p className={styles.subtitle}>Decentralized Perpetuals Exchange</p>
        </div>

        <div className={styles.connectSection}>
          {!isConnected ? (
            <>
              <p className={styles.connectText}>
                Connect your wallet to start trading
              </p>
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button className={styles.connectBtn} onClick={show}>
                    <Icon name="wallet" size="sm" />
                    Connect Wallet
                  </button>
                )}
              </ConnectKitButton.Custom>
            </>
          ) : !isAuthenticated ? (
            <>
              <p className={styles.connectText}>
                Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <button
                className={styles.connectBtn}
                onClick={handleAuth}
                disabled={gatewayAuth.isPending}
              >
                {gatewayAuth.isPending ? (
                  <Icon name="loader" className={styles.spinner} />
                ) : (
                  <>
                    <Icon name="shield-check" size="sm" />
                    Sign In to Exchange
                  </>
                )}
              </button>
              {gatewayAuth.isError && (
                <p className={styles.error}>
                  {gatewayAuth.error.message}
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${isConnected ? styles.ok : styles.pending}`} />
              <span>Wallet</span>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${isAuthenticated ? styles.ok : styles.pending}`} />
              <span>Gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
