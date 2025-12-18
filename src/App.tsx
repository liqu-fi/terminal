import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { DataConfidenceBar } from './components/DataConfidenceBar';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageToggle } from './components/LanguageToggle';
import { ToastContainer } from './components/Toast';
import { WelcomeGuide } from './components/WelcomeGuide';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { SoundToggle } from './components/SoundToggle';
import { TopNav } from './components/Layout';
import { Icon } from './components/Icon';
import { TradePage } from './pages/TradePage';
import { MarketsPage } from './pages/MarketsPage';
import { WalletPage } from './pages/WalletPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { useI18n } from './i18n';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import styles from './App.module.css';

export function App() {
  const { t } = useI18n();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 't',
      action: () => {
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme');
        root.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
        localStorage.setItem('theme', currentTheme === 'dark' ? 'light' : 'dark');
      },
      description: 'Toggle theme',
    },
  ]);

  return (
    <div className="app-container">
      {/* Data Confidence Bar */}
      <DataConfidenceBar />

      {/* Header */}
      <header className="app-header">
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          <span className={styles.title}>{t.header.title}</span>
        </div>

        {/* Navigation */}
        <TopNav />

        <div className={styles.actions}>
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
        </div>
      </header>

      {/* Main Content - Routes */}
      <main className={styles.main}>
        <Routes>
          <Route path="/trade" element={<TradePage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/trade" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
      </footer>

      {/* Toast Container */}
      <ToastContainer />

      {/* Welcome Guide */}
      <WelcomeGuide />
    </div>
  );
}
