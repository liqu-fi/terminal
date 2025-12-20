import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '../BottomNav';
import { ToastContainer } from '../Toast';
import styles from './MobileLayout.module.css';

export function MobileLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <Outlet />
      </main>

      {!isAuthPage && <BottomNav />}
      
      <ToastContainer />
    </div>
  );
}

