import { NavLink } from 'react-router-dom';
import { useI18n } from '../../i18n';
import styles from './TopNav.module.css';

export function TopNav() {
  const { t } = useI18n();

  return (
    <nav className={styles.nav}>
      <NavLink 
        to="/assets" 
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
      >
        {t.wallet?.overview || 'Overview'}
      </NavLink>
      <NavLink 
        to="/trade" 
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
      >
        {t.nav?.trade || 'Trade'}
      </NavLink>
      <NavLink 
        to="/markets" 
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
      >
        {t.nav?.markets || 'Markets'}
      </NavLink>
      <NavLink 
        to="/wallet" 
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
      >
        {t.nav?.wallet || 'Wallet'}
      </NavLink>
      <NavLink 
        to="/orders" 
        className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
      >
        {t.nav?.orders || 'Orders'}
      </NavLink>
    </nav>
  );
}





