import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { DataConfidenceBar } from './components/DataConfidenceBar';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageToggle } from './components/LanguageToggle';
import { ToastContainer } from './components/Toast';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { SoundToggle } from './components/SoundToggle';
import { TopNav, AssetSnapshot, AccountMenu } from './components/Layout';
import { BottomNav } from './components/BottomNav';
import { Icon } from './components/Icon';
import { TradePage } from './pages/TradePage';
import { MarketsPage } from './pages/MarketsPage';
import { WalletPage } from './pages/WalletPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { useI18n } from './i18n';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAuthStore } from './store/authStore';
import styles from './App.module.css';

// Private Route Component
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

export function App() {
  const { t } = useI18n();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuthStore();
  
  const isAuthPage = location.pathname === '/auth';
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

  if (isAuthPage) {
    return (
      <div className="app-container">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
        <ToastContainer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="app-container">
      {/* Data Confidence Bar */}
      {showDataConfidenceBar && <DataConfidenceBar />}

      {/* Header */}
      <header className="app-header">
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Icon name="activity" size="lg" strokeWidth={2.5} />
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
              <AccountMenu />
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Routes */}
      <main className={styles.main}>
        <Routes>
          <Route path="/trade" element={<PrivateRoute><TradePage /></PrivateRoute>} />
          <Route path="/markets" element={<PrivateRoute><MarketsPage /></PrivateRoute>} />
          <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
          <Route path="/assets" element={<PrivateRoute><AssetDetailPage /></PrivateRoute>} />
          <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<Navigate to="/trade" replace />} />
          <Route path="*" element={<Navigate to="/trade" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
      </footer>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav />

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}
