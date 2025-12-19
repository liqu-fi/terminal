import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import styles from './AuthPage.module.css';

export const AuthPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [systemCheck, setSystemCheck] = useState({
    ws: 'pending',
    engine: 'pending',
    security: 'pending',
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/trade');
    }
  }, [isAuthenticated, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      await login(username);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.overlay} />
      
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Icon name="activity" size="xl" strokeWidth={2.5} />
            <span className={styles.title}>TBT TRADING</span>
          </div>
          <p className={styles.subtitle}>{t.header.title}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t.common?.username || 'Username'}</label>
            <div className={styles.inputWrapper}>
              <Icon name="briefcase" size="sm" className={styles.inputIcon} />
              <input 
                type="text" 
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.common?.usernamePlaceholder || 'Enter your terminal ID'}
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t.common?.password || 'Password'}</label>
            <div className={styles.inputWrapper}>
              <Icon name="settings" size="sm" className={styles.inputIcon} />
              <input 
                type="password" 
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.common?.passwordPlaceholder || '••••••••'}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn} 
            disabled={isLoading}
          >
            {isLoading ? (
              <Icon name="loader" className={styles.spinner} />
            ) : (
              t.common?.login || 'Initialize Session'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <div className={styles.systemStatus}>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${styles[systemCheck.ws]}`} />
              CORE_WS
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${styles[systemCheck.engine]}`} />
              MATCH_ENG
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${styles[systemCheck.security]}`} />
              SEC_SHIELD
            </div>
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

