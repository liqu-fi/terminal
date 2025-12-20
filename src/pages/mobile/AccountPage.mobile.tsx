import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MobileHeader } from '../../components/Layout';
import { MobileActionSheet, MobileDrawer } from '../../components/mobile';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import styles from './AccountPage.mobile.module.css';

export function MobileAccountPage() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const { user, preferences, logout, updatePreferences } = useAuthStore();
  const { trigger } = useHapticFeedback();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLangSheet, setShowLangSheet] = useState(false);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showSecurityDrawer, setShowSecurityDrawer] = useState(false);

  const handleLogout = () => {
    trigger('heavy');
    logout();
    navigate('/auth');
  };

  const toggleTheme = (theme: 'light' | 'dark' | 'system') => {
    trigger('selection');
    updatePreferences({ theme });
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
    setShowThemeSheet(false);
  };

  const changeLang = (lang: 'zh-CN' | 'en-US') => {
    trigger('selection');
    setLocale(lang);
    updatePreferences({ language: lang });
    setShowLangSheet(false);
  };

  if (!user) return null;

  return (
    <div className={styles.container}>
      <MobileHeader 
        title={t.nav?.account || 'Account'} 
        showActions={false}
        rightAction={
          <button className={styles.headerBtn} onClick={() => { trigger('light'); setShowSettingsDrawer(true); }}>
            <Icon name="settings" size="md" />
          </button>
        }
      />

      <div className={styles.scrollContent}>
        {/* User Info Section */}
        <div className={styles.userSection}>
          <div className={styles.userCard}>
            <div className={styles.avatarWrapper}>
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className={styles.avatar} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <Icon name="user" size="lg" />
                </div>
              )}
              <div className={styles.vipBadge}>{t.account?.vip || 'VIP'} 0</div>
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userNameRow}>
                <h2 className={styles.userName}>{user.displayName || user.username}</h2>
                <div className={styles.verifyBadge}>
                  <Icon name="check-circle" size="xs" />
                  <span>{t.account?.verified || 'Verified'}</span>
                </div>
              </div>
              <p className={styles.uid}>{t.account?.uid || 'UID'}: {user.id.slice(0, 8)}</p>
            </div>
            <Icon name="chevron-right" size="sm" className={styles.arrow} />
          </div>
        </div>

        {/* Settings Groups */}
        <div className={styles.section}>
          <div className={styles.listGroup}>
            <button className={styles.listItem} onClick={() => setShowLangSheet(true)}>
              <div className={styles.itemLeft}>
                <Icon name="languages" size="sm" className={styles.itemIcon} />
                <span>{t.language?.label || 'Language'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>{locale === 'zh-CN' ? '简体中文' : 'English'}</span>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
            <button className={styles.listItem} onClick={() => setShowThemeSheet(true)}>
              <div className={styles.itemLeft}>
                <Icon name={preferences.theme === 'dark' ? 'moon' : 'sun'} size="sm" className={styles.itemIcon} />
                <span>{t.settings?.display?.theme || 'Theme'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>
                  {preferences.theme === 'system' 
                    ? (t.settings?.display?.system || 'System')
                    : preferences.theme === 'dark' 
                      ? (t.settings?.display?.dark || 'Dark')
                      : (t.settings?.display?.light || 'Light')}
                </span>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
            <button className={styles.listItem} onClick={() => { trigger('light'); setShowSecurityDrawer(true); }}>
              <div className={styles.itemLeft}>
                <Icon name="shield" size="sm" className={styles.itemIcon} />
                <span>{t.settings?.categories?.security || 'Security'}</span>
              </div>
              <div className={styles.itemRight}>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
          </div>

          <div className={styles.listGroup}>
            <button className={styles.listItem}>
              <div className={styles.itemLeft}>
                <Icon name="help-circle" size="sm" className={styles.itemIcon} />
                <span>{t.account?.toolSupport || 'Help & Support'}</span>
              </div>
              <div className={styles.itemRight}>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
            <button className={styles.listItem}>
              <div className={styles.itemLeft}>
                <Icon name="info" size="sm" className={styles.itemIcon} />
                <span>{t.settings?.advanced?.version || 'About Us'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>v0.1.0</span>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
          </div>

          <button 
            className={styles.logoutBtn}
            onClick={() => setShowLogoutConfirm(true)}
          >
            {t.account?.logoutConfirmTitle || 'Log Out'}
          </button>
        </div>
      </div>

      {/* Sheets */}
      <MobileActionSheet
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title={t.account?.logoutConfirmTitle || 'Log Out'}
        message={t.account?.logoutConfirmMessage || 'Are you sure you want to log out of your account?'}
        actions={[
          { id: 'logout', label: t.account?.logoutConfirmTitle || 'Log Out', destructive: true, icon: 'log-out' }
        ]}
        onAction={handleLogout}
      />

      <MobileActionSheet
        isOpen={showLangSheet}
        onClose={() => setShowLangSheet(false)}
        title={t.account?.selectLanguage || 'Select Language'}
        actions={[
          { id: 'zh-CN', label: '简体中文' },
          { id: 'en-US', label: 'English' }
        ]}
        onAction={(id) => changeLang(id as any)}
      />

      <MobileActionSheet
        isOpen={showThemeSheet}
        onClose={() => setShowThemeSheet(false)}
        title={t.account?.selectTheme || 'Select Theme'}
        actions={[
          { id: 'light', label: t.settings?.display?.light || 'Light', icon: 'sun' },
          { id: 'dark', label: t.settings?.display?.dark || 'Dark', icon: 'moon' },
          { id: 'system', label: t.settings?.display?.system || 'System', icon: 'monitor' }
        ]}
        onAction={(id) => toggleTheme(id as any)}
      />

      {/* Settings Drawer */}
      <MobileDrawer
        isOpen={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
        title={t.settings?.title || 'Settings'}
        height="auto"
      >
        <div className={styles.drawerContent}>
          <div className={styles.listGroup}>
            <button className={styles.listItem} onClick={() => setShowLangSheet(true)}>
              <div className={styles.itemLeft}>
                <Icon name="languages" size="sm" className={styles.itemIcon} />
                <span>{t.language?.label || 'Language'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>{locale === 'zh-CN' ? '简体中文' : 'English'}</span>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
            <button className={styles.listItem} onClick={() => setShowThemeSheet(true)}>
              <div className={styles.itemLeft}>
                <Icon name={preferences.theme === 'dark' ? 'moon' : 'sun'} size="sm" className={styles.itemIcon} />
                <span>{t.settings?.display?.theme || 'Theme'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>
                  {preferences.theme === 'system' 
                    ? (t.settings?.display?.system || 'System')
                    : preferences.theme === 'dark' 
                      ? (t.settings?.display?.dark || 'Dark')
                      : (t.settings?.display?.light || 'Light')}
                </span>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
          </div>
          <div className={styles.listGroup}>
            <button className={styles.listItem} onClick={() => {
              trigger('selection');
              const nextAsset = preferences.quoteAsset === 'USDT' ? 'BTC' : 'USDT';
              updatePreferences({ quoteAsset: nextAsset });
            }}>
              <div className={styles.itemLeft}>
                <Icon name="banknote" size="sm" className={styles.itemIcon} />
                <span>{t.account?.defaultQuoteAsset || 'Default Quote Asset'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>{preferences.quoteAsset}</span>
                <Icon name="refresh-cw" size="xs" />
              </div>
            </button>
          </div>
        </div>
      </MobileDrawer>

      {/* Security Drawer */}
      <MobileDrawer
        isOpen={showSecurityDrawer}
        onClose={() => setShowSecurityDrawer(false)}
        title={t.settings?.categories?.security || 'Security'}
        height="auto"
      >
        <div className={styles.drawerContent}>
          <div className={styles.listGroup}>
            <div className={styles.listItem}>
              <div className={styles.itemLeft}>
                <Icon name="lock" size="sm" className={styles.itemIcon} />
                <span>{t.settings?.security?.loginPassword || 'Login Password'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>{t.settings?.security?.lastChanged || 'Last changed'}: {t.time?.today || 'Today'}</span>
              </div>
            </div>
            <div className={styles.listItem}>
              <div className={styles.itemLeft}>
                <Icon name="shield-check" size="sm" className={styles.itemIcon} />
                <span>{t.settings?.security?.twoFactorAuth || 'Two-Factor Auth'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue} style={{ color: 'var(--color-success)' }}>{t.settings?.security?.enabled || 'Enabled'}</span>
              </div>
            </div>
          </div>
          <p className={styles.drawerHint}>
            {t.account?.securityMoreHint || 'More security settings can be accessed on the desktop version.'}
          </p>
        </div>
      </MobileDrawer>
    </div>
  );
}

