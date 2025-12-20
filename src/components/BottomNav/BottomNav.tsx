import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './BottomNav.module.css';

interface NavItem {
  path: string;
  icon: string;
  labelKey: string;
  fallback: string;
}

const navItems: NavItem[] = [
  { path: '/markets', icon: 'trending-up', labelKey: 'markets', fallback: 'Markets' },
  { path: '/trade', icon: 'activity', labelKey: 'trade', fallback: 'Trade' },
  { path: '/orders', icon: 'layers', labelKey: 'orders', fallback: 'Orders' },
  { path: '/wallet', icon: 'wallet', labelKey: 'wallet', fallback: 'Wallet' },
  { path: '/settings', icon: 'menu', labelKey: 'more', fallback: 'More' },
];

export function BottomNav() {
  const { t } = useI18n();
  const location = useLocation();

  // Don't show on auth page
  if (location.pathname === '/auth') {
    return null;
  }

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <Icon name={item.icon} size="md" className={styles.icon} />
          <span className={styles.label}>
            {(t.nav as Record<string, string>)?.[item.labelKey] || item.fallback}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

