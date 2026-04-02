import { Outlet, Link, useLocation } from 'react-router-dom';
import { DataConfidenceBar } from '../DataConfidenceBar';
import { ThemeToggle } from '../ThemeToggle';
import { LanguageToggle } from '../LanguageToggle';
import { ToastContainer } from '../Toast';
import { ShortcutsHelp } from '../ShortcutsHelp';
import { SoundToggle } from '../SoundToggle';
import { TopNav, AssetSnapshot } from './index';
import { Icon } from '../Icon';
import { useI18n } from '../../i18n';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { ConnectKitButton } from 'connectkit';
import { useAuthStore } from '../../store/authStore';
import styles from './DesktopLayout.module.css';

export function DesktopLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  
  const showDataConfidenceBar = (location.pathname === '/trade' || location.pathname === '/') && isAuthenticated;

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 't',
      action: () => {
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', nextTheme);
        localStorage.setItem('theme', nextTheme);
      },
      description: 'Toggle theme',
    },
  ]);

  return (
    <div className="app-container">
      {/* Data Confidence Bar */}
      {showDataConfidenceBar && <DataConfidenceBar />}

      {/* Header */}
      <header className="app-header">
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Icon name="trending-up" size="lg" strokeWidth={2.5} />
          </div>
          <span className={styles.title}>{t.header.title}</span>
        </div>

        {/* Navigation */}
        <TopNav />

        <div className={styles.actions}>
          <AssetSnapshot />
          <Link 
            to="/settings" 
            className={styles.settingsBtn}
            title={t.settings?.title || 'Settings'}
          >
            <Icon name="settings" size="md" />
          </Link>
          <ShortcutsHelp />
          <SoundToggle />
          <LanguageToggle />
          <ThemeToggle />
          
          {isAuthenticated && (
            <div className={styles.accountWrapper}>
              <ConnectKitButton showBalance={false} />
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Routes */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
      </footer>

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}

