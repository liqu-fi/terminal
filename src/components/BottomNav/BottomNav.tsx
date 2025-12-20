import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Icon, IconName } from '../Icon';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import styles from './BottomNav.module.css';

interface NavItem {
  path: string;
  icon: IconName;
  labelKey: string;
  fallback: string;
  isCenter?: boolean;
}

const navItems: NavItem[] = [
  { path: '/markets', icon: 'bar-chart-3', labelKey: 'markets', fallback: 'Markets' },
  { path: '/orders', icon: 'layers', labelKey: 'orders', fallback: 'Orders' },
  { path: '/trade', icon: 'arrow-up-down', labelKey: 'trade', fallback: 'Trade', isCenter: true },
  { path: '/wallet', icon: 'wallet', labelKey: 'wallet', fallback: 'Wallet' },
  { path: '/settings', icon: 'user', labelKey: 'account', fallback: 'Account' },
];

export function BottomNav() {
  const { t } = useI18n();
  const location = useLocation();
  const { trigger } = useHapticFeedback();

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
          onClick={() => trigger(item.isCenter ? 'medium' : 'selection')}
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''} ${item.isCenter ? styles.centerItem : ''}`
          }
        >
          {item.isCenter ? (
            <>
              <div className={styles.centerButton}>
                <Icon name={item.icon} size="lg" className={styles.centerIcon} />
              </div>
              <span className={`${styles.label} ${styles.centerLabel}`}>
                {(t.nav as Record<string, string>)?.[item.labelKey] || item.fallback}
              </span>
            </>
          ) : (
            <>
              <Icon name={item.icon} size="md" className={styles.icon} />
              <span className={styles.label}>
                {(t.nav as Record<string, string>)?.[item.labelKey] || item.fallback}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
