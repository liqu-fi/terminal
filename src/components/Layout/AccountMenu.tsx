import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button 
        className={`${styles.trigger} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.avatar}>
          {user.avatar ? (
            <img src={user.avatar} alt="" className={styles.avatarImg} />
          ) : (
            <Icon name="user" size="sm" strokeWidth={2} />
          )}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.username}>{user.displayName || user.username}</span>
          <span className={styles.accountStatus}>ACTIVE</span>
        </div>
        <Icon name="chevron-down" size="xs" className={`${styles.chevron} ${isOpen ? styles.rotated : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <div className={styles.profileInfo}>
              <div className={styles.largeAvatar}>
                {user.avatar ? (
                  <img src={user.avatar} alt="" className={styles.largeAvatarImg} />
                ) : (
                  <Icon name="user" size="md" />
                )}
              </div>
              <div className={styles.profileText}>
                <span className={styles.profileName}>{user.displayName || user.username}</span>
                <span className={styles.profileId}>ID: {user.id}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.menuItems}>
            <div className={styles.menuSection}>
              <span className={styles.sectionLabel}>
                {t.common?.login === '登录' ? '会话信息' : 'SESSION'}
              </span>
              <div className={styles.menuItem}>
                <Icon name="clock" size="xs" />
                <span>
                  {t.common?.login === '登录' ? '上次登录: ' : 'Last login: '}
                  {new Date(user.lastLogin).toLocaleTimeString()}
                </span>
              </div>
            </div>
            
            <div className={styles.divider} />
            
            <Link 
              to="/settings" 
              className={styles.menuItem}
              onClick={() => setIsOpen(false)}
            >
              <Icon name="settings" size="xs" />
              <span>{t.accountOverview?.accountSettings || (t.common?.login === '登录' ? '账户设置' : 'Account Settings')}</span>
            </Link>
            
            <Link 
              to="/wallet" 
              className={styles.menuItem}
              onClick={() => setIsOpen(false)}
            >
              <Icon name="wallet" size="xs" />
              <span>{t.accountOverview?.viewWallet || (t.common?.login === '登录' ? '钱包' : 'Wallet')}</span>
            </Link>
            
            <div className={styles.divider} />
            
            <button className={`${styles.menuItem} ${styles.logoutItem}`} onClick={handleLogout}>
              <Icon name="log-out" size="xs" />
              <span>{t.common?.login === '登录' ? '退出登录' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
