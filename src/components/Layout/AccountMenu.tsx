import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AccountMenu.module.css';

export const AccountMenu: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className={styles.container} ref={menuRef}>
      <button 
        className={`${styles.trigger} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.avatar}>
          <Icon name="briefcase" size="sm" strokeWidth={2} />
        </div>
        <div className={styles.userInfo}>
          <span className={styles.username}>{user.username}</span>
          <span className={styles.accountStatus}>ACTIVE</span>
        </div>
        <Icon name="chevron-down" size="xs" className={`${styles.chevron} ${isOpen ? styles.rotated : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <div className={styles.profileInfo}>
              <div className={styles.largeAvatar}>
                <Icon name="briefcase" size="md" />
              </div>
              <div className={styles.profileText}>
                <span className={styles.profileName}>{user.username}</span>
                <span className={styles.profileId}>ID: {user.id}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.menuItems}>
            <div className={styles.menuSection}>
              <span className={styles.sectionLabel}>SESSION</span>
              <div className={styles.menuItem}>
                <Icon name="clock" size="xs" />
                <span>Last login: {new Date(user.lastLogin).toLocaleTimeString()}</span>
              </div>
            </div>
            
            <div className={styles.divider} />
            
            <button className={`${styles.menuItem} ${styles.logoutItem}`} onClick={logout}>
              <Icon name="x" size="xs" />
              <span>{t.common.login === '登录' ? '退出会话' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
