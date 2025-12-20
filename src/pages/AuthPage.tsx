import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import { useIsMobile } from '../hooks/useMediaQuery';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import styles from './AuthPage.module.css';

type AuthMode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { login, register, isAuthenticated, isLoading, isInitialized, markAsInitialized } = useAuthStore();
  const { grantInitialFunds, hasReceivedInitialGrant } = useWalletStore();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [systemCheck, setSystemCheck] = useState({
    ws: 'pending',
    engine: 'pending',
    security: 'pending',
  });

  useEffect(() => {
    if (isAuthenticated) {
      // Grant initial funds if not already done
      if (!isInitialized && !hasReceivedInitialGrant) {
        const granted = grantInitialFunds();
        if (granted) {
          markAsInitialized();
        }
      }
      navigate('/trade');
    }
  }, [isAuthenticated, isInitialized, hasReceivedInitialGrant, grantInitialFunds, markAsInitialized, navigate]);

  // Simulate system checks on mount
  useEffect(() => {
    const runChecks = async () => {
      await new Promise(r => setTimeout(r, 600));
      setSystemCheck(prev => ({ ...prev, ws: 'ok' }));
      await new Promise(r => setTimeout(r, 400));
      setSystemCheck(prev => ({ ...prev, engine: 'ok' }));
      await new Promise(r => setTimeout(r, 500));
      setSystemCheck(prev => ({ ...prev, security: 'ok' }));
    };
    runChecks();
  }, []);

  const validateForm = (): boolean => {
    setError(null);
    
    if (!username.trim()) {
      setError(t.auth?.usernameRequired || 'Username is required');
      return false;
    }
    
    if (!password) {
      setError(t.auth?.passwordRequired || 'Password is required');
      return false;
    }
    
    if (password.length < 6) {
      setError(t.auth?.passwordTooShort || 'Password must be at least 6 characters');
      return false;
    }
    
    if (mode === 'register' && password !== confirmPassword) {
      setError(t.auth?.passwordMismatch || 'Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setError(null);
    
    if (mode === 'register') {
      const result = await register(username.trim(), password);
      if (!result.success) {
        setError(t.auth?.[result.error as keyof typeof t.auth] || result.error || 'Registration failed');
      }
    } else {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(t.auth?.[result.error as keyof typeof t.auth] || result.error || 'Login failed');
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setConfirmPassword('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.overlay} />
      
      {/* Quick Settings Bar */}
      <div className={styles.settingsBar}>
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Icon name="activity" size={isMobile ? "lg" : "xl"} strokeWidth={2.5} />
            <span className={styles.title}>TBT TRADING</span>
          </div>
          <p className={styles.subtitle}>{t.header.title}</p>
        </div>

        {/* Enhanced Welcome Banner with Features */}
        <div className={styles.welcomeBanner}>
          <div className={styles.welcomeHeader}>
            <Icon name="star" size="sm" className={styles.welcomeIcon} />
            <h3 className={styles.welcomeTitle}>Welcome to TBT Trading</h3>
          </div>
          
          {!isMobile ? (
            <div className={styles.welcomeContent}>
              <div className={styles.welcomeTextZh}>
                <p className={styles.welcomeParagraph}>
                  {t.auth?.welcomeMessageZh}
                </p>
              </div>
              <div className={styles.welcomeDivider} />
              <div className={styles.welcomeTextEn}>
                <p className={styles.welcomeParagraph}>
                  {t.auth?.welcomeMessageEn}
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.welcomeContentMobile}>
              <p className={styles.welcomeTextCompact}>
                专业数字资产交易终端 • 虚拟赠金 30 万美元
              </p>
            </div>
          )}

          {/* Feature Highlights - Grid on Desktop, Scrolling on Mobile if needed, but here we just simplify */}
          {!isMobile && (
            <div className={styles.featuresGrid}>
              <div className={styles.featureItem}>
                <Icon name="shield" size="xs" />
                <span>Bank-Grade Security</span>
              </div>
              <div className={styles.featureItem}>
                <Icon name="zap" size="xs" />
                <span>Real-Time Trading</span>
              </div>
              <div className={styles.featureItem}>
                <Icon name="trending-up" size="xs" />
                <span>Advanced Analytics</span>
              </div>
              <div className={styles.featureItem}>
                <Icon name="smartphone" size="xs" />
                <span>Multi-Platform</span>
              </div>
            </div>
          )}

          {/* Account Benefits */}
          <div className={styles.benefitsCard}>
            <div className={styles.benefitItem}>
              <div className={styles.benefitIcon}>
                <Icon name="dollar-sign" size="sm" />
              </div>
              <div className={styles.benefitContent}>
                <span className={styles.benefitValue}>$300,000</span>
                {!isMobile && <span className={styles.benefitLabel}>Virtual Trading Capital</span>}
              </div>
            </div>
            <div className={styles.benefitDivider} />
            <div className={styles.benefitItem}>
              <div className={styles.benefitIcon}>
                <Icon name="credit-card" size="sm" />
              </div>
              <div className={styles.benefitContent}>
                <span className={styles.benefitValue}>{isMobile ? "UNLIMITED" : "Unlimited"}</span>
                {!isMobile && <span className={styles.benefitLabel}>Bank Card Support</span>}
              </div>
            </div>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t.common?.username || 'Username'}</label>
            <div className={styles.inputWrapper}>
              <Icon name="user" size="sm" className={styles.inputIcon} />
              <input 
                type="text" 
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.common?.usernamePlaceholder || 'Enter username'}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t.common?.password || 'Password'}</label>
            <div className={styles.inputWrapper}>
              <Icon name="lock" size="sm" className={styles.inputIcon} />
              <input 
                type="password" 
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.common?.passwordPlaceholder || '••••••••'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>{t.auth?.confirmPassword || 'Confirm Password'}</label>
              <div className={styles.inputWrapper}>
                <Icon name="lock" size="sm" className={styles.inputIcon} />
                <input 
                  type="password" 
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.common?.passwordPlaceholder || '••••••••'}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              <Icon name="alert-circle" size="sm" />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className={styles.submitBtn} 
            disabled={isLoading}
          >
            {isLoading ? (
              <Icon name="loader" className={styles.spinner} />
            ) : (
              mode === 'register' 
                ? (t.auth?.createAccount || 'Create Account')
                : (t.auth?.signIn || 'Sign In')
            )}
          </button>

          <div className={styles.modeSwitch}>
            <span className={styles.modeSwitchText}>
              {mode === 'login' 
                ? (t.auth?.noAccount || "Don't have an account?")
                : (t.auth?.haveAccount || 'Already have an account?')
              }
            </span>
            <button 
              type="button" 
              className={styles.modeSwitchBtn}
              onClick={toggleMode}
            >
              {mode === 'login' 
                ? (t.auth?.switchToRegister || 'Sign Up')
                : (t.auth?.switchToLogin || 'Sign In')
              }
            </button>
          </div>
        </form>

        {/* Enhanced Footer with Security & Status */}
        <div className={styles.footer}>
          {!isMobile && (
            <div className={styles.securityBadges}>
              <div className={styles.badge}>
                <Icon name="shield-check" size="xs" />
                <span>SSL Encrypted</span>
              </div>
              <div className={styles.badge}>
                <Icon name="lock" size="xs" />
                <span>2FA Ready</span>
              </div>
              <div className={styles.badge}>
                <Icon name="shield" size="xs" />
                <span>Privacy First</span>
              </div>
            </div>
          )}
          
          <div className={styles.systemStatus}>
            <div className={styles.statusHeader}>
              <Icon name="activity" size="xs" />
              <span>{isMobile ? "Network Status" : "System Status"}</span>
              {isMobile && <span className={styles.statusBadge}>Online</span>}
            </div>
            {!isMobile && (
              <div className={styles.statusGrid}>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.ws]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>WebSocket</span>
                    <span className={styles.statusValue}>{systemCheck.ws === 'ok' ? 'Connected' : 'Connecting...'}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.engine]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Matching Engine</span>
                    <span className={styles.statusValue}>{systemCheck.engine === 'ok' ? 'Operational' : 'Initializing...'}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.security]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Security Layer</span>
                    <span className={styles.statusValue}>{systemCheck.security === 'ok' ? 'Active' : 'Loading...'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.decor}>
        <div className={styles.line} />
        <div className={styles.grid} />
      </div>
    </div>
  );
};
