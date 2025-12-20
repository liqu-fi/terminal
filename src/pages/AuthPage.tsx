import { useState, useEffect } from 'react';
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
  const { t, locale } = useI18n();
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
      <div className={styles.decor}>
        <div className={styles.grid} />
      </div>
      <div className={styles.overlay} />
      
      {/* Quick Settings Bar - Desktop Only */}
      {!isMobile && (
        <div className={styles.settingsBar}>
          <LanguageToggle />
          <div className={styles.settingsDivider} />
          <ThemeToggle />
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Icon name="activity" size={isMobile ? "lg" : "xl"} strokeWidth={3} />
          </div>
          <span className={styles.title}>TBT TRADING</span>
          <p className={styles.subtitle}>{t.header.title}</p>
        </div>

        {/* Enhanced Welcome Banner */}
        <div className={styles.welcomeBanner}>
          <h3 className={styles.welcomeTitle}>
            {mode === 'login' ? t.auth?.welcomeTitle || 'Welcome' : t.auth?.signUp || 'Sign Up'}
          </h3>
          <div className={styles.welcomeContent}>
            <p className={styles.welcomeParagraph}>
              {isMobile 
                ? t.auth?.welcomeMessageMobile 
                : (locale === 'zh-CN' ? t.auth?.welcomeMessageZh : t.auth?.welcomeMessageEn)}
            </p>
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
                ? (t.auth?.createAccount || 'Get Started')
                : (t.auth?.signIn || 'Login Now')
            )}
          </button>

          <div className={styles.modeSwitch}>
            <span className={styles.modeSwitchText}>
              {mode === 'login' 
                ? (t.auth?.noAccount || "New to TBT?")
                : (t.auth?.haveAccount || 'Already a member?')
              }
            </span>
            <button 
              type="button" 
              className={styles.modeSwitchBtn}
              onClick={toggleMode}
            >
              {mode === 'login' 
                ? (t.auth?.switchToRegister || 'Create Account')
                : (t.auth?.switchToLogin || 'Sign In')
              }
            </button>
          </div>
        </form>

        {/* Enhanced Footer - Desktop */}
        {!isMobile && (
          <div className={styles.footer}>
            <div className={styles.securityBadges}>
              <div className={styles.badge}>
                <Icon name="shield-check" size="xs" />
                <span>SSL SECURE</span>
              </div>
              <div className={styles.badge}>
                <Icon name="lock" size="xs" />
                <span>2FA READY</span>
              </div>
            </div>
            
            <div className={styles.systemStatus}>
              <div className={styles.statusHeader}>
                <Icon name="activity" size="xs" />
                <span>Real-Time Engine Status</span>
              </div>
              <div className={styles.statusGrid}>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.ws]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>WebSocket</span>
                    <span className={styles.statusValue}>{systemCheck.ws === 'ok' ? 'Connected' : '...'}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.engine]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Matching</span>
                    <span className={styles.statusValue}>{systemCheck.engine === 'ok' ? 'Active' : '...'}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.security]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Security</span>
                    <span className={styles.statusValue}>{systemCheck.security === 'ok' ? 'Active' : '...'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Footer - Compact System Status & Security */}
        {isMobile && (
          <div className={styles.mobileFooter}>
            <div className={styles.mobileSystemStatus}>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.ws === 'ok' ? styles.ok : systemCheck.ws === 'pending' ? styles.pending : ''}`} />
                <span>WS</span>
              </div>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.engine === 'ok' ? styles.ok : systemCheck.engine === 'pending' ? styles.pending : ''}`} />
                <span>Engine</span>
              </div>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.security === 'ok' ? styles.ok : systemCheck.security === 'pending' ? styles.pending : ''}`} />
                <span>Security</span>
              </div>
            </div>
            <div className={styles.mobileSecurityBadges}>
              <div className={styles.mobileSecurityBadge}>
                <Icon name="shield-check" size="xs" />
                <span>SSL</span>
              </div>
              <div className={styles.mobileSecurityBadge}>
                <Icon name="lock" size="xs" />
                <span>2FA</span>
              </div>
            </div>
            {/* Mobile Language Toggle Only */}
            <div className={styles.mobileLanguageToggle}>
              <LanguageToggle />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
