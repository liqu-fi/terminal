import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdaptiveLayout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { TradePage } from './pages/TradePage';
import { MarketsPage } from './pages/MarketsPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { useAuthStore } from './store/authStore';

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

  if (location.pathname === '/auth') {
    return <AuthPageWrapper />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Routes>
      <Route element={<AdaptiveLayout />}>
        <Route path="/trade" element={<TradePage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/trade" replace />} />
        <Route path="*" element={<Navigate to="/trade" replace />} />
      </Route>
    </Routes>
  );
}
