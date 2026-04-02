import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AccountMenu.module.css';

export const AccountMenu: React.FC = () => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={`${styles.trigger} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.avatar}>
          <Icon name="user" size="sm" strokeWidth={2} />
        </div>
        <Icon name="chevron-down" size="xs" className={`${styles.chevron} ${isOpen ? styles.rotated : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <div className={styles.profileInfo}>
              <div className={styles.largeAvatar}>
                <Icon name="user" size="md" />
              </div>
              <div className={styles.profileText}>
                <span className={styles.profileName}>Wallet User</span>
              </div>
            </div>
          </div>

          <div className={styles.menuItems}>
            <Link
              to="/settings"
              className={styles.menuItem}
              onClick={() => setIsOpen(false)}
            >
              <Icon name="settings" size="xs" />
              <span>{t.accountOverview?.accountSettings || 'Account Settings'}</span>
            </Link>

            <button
              className={styles.menuItem}
              onClick={(e) => {
                e.preventDefault();
                toggleTheme();
              }}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size="xs" />
              <span>
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </button>

            <div className={styles.divider} />

            <div className={styles.menuItem}>
              <ConnectKitButton showBalance={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
