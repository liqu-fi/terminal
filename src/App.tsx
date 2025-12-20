import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdaptiveLayout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { TradePage } from './pages/TradePage';
import { MarketsPage } from './pages/MarketsPage';
import { WalletPage } from './pages/WalletPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { useAuthStore } from './store/authStore';

// Private Route Component
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// Auth page wrapper - standalone without layout
function AuthPageWrapper() {
  return (
    <div className="app-container">
      <AuthPage />
      <ToastContainer />
    </div>
  );
}

export function App() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  
  // Auth page is rendered standalone without the adaptive layout
  if (location.pathname === '/auth') {
    return <AuthPageWrapper />;
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Routes>
      <Route element={<AdaptiveLayout />}>
        <Route path="/trade" element={<PrivateRoute><TradePage /></PrivateRoute>} />
        <Route path="/markets" element={<PrivateRoute><MarketsPage /></PrivateRoute>} />
        <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
        <Route path="/assets" element={<PrivateRoute><AssetDetailPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/trade" replace />} />
        <Route path="*" element={<Navigate to="/trade" replace />} />
      </Route>
    </Routes>
  );
}
