import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import { AvatarUpload } from '../components/AvatarUpload';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MobileAccountPage } from './mobile';
import styles from './SettingsPage.module.css';

type SettingsSection = 'profile' | 'security' | 'preferences';

export function SettingsPage() {
  const isMobile = useIsMobile();
  const { t, locale, setLocale } = useI18n();
  const { user, preferences, updateProfile, updateAvatar, updatePreferences, changePassword } = useAuthStore();
  
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  // Render mobile layout
  if (isMobile) {
    return <MobileAccountPage />;
  }

  
  // Profile form state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [profileSaved, setProfileSaved] = useState(false);
  
  // Password form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // Preferences state
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(preferences.theme);
  const [quoteAsset, setQuoteAsset] = useState<'USDT' | 'BTC'>(preferences.quoteAsset);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setTimezone(user.timezone || 'UTC');
    }
  }, [user]);

  useEffect(() => {
    setCurrentTheme(preferences.theme);
    setQuoteAsset(preferences.quoteAsset);
  }, [preferences]);

  const handleSaveProfile = () => {
    updateProfile({ displayName, bio, timezone });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleChangePassword = () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    
    if (newPassword.length < 6) {
      setPasswordError(t.auth?.passwordTooShort || 'Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t.auth?.passwordMismatch || 'Passwords do not match');
      return;
    }
    
    const result = changePassword(oldPassword, newPassword);
    if (result.success) {
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } else {
      setPasswordError(
        result.error === 'incorrectPassword' 
          ? (locale === 'zh-CN' ? '当前密码错误' : 'Current password is incorrect')
          : (locale === 'zh-CN' ? '修改失败' : 'Failed to change password')
      );
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setCurrentTheme(theme);
    updatePreferences({ theme });
    
    // Apply theme immediately
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  };

  const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
    setLocale(lang);
    updatePreferences({ language: lang });
  };

  const handleQuoteAssetChange = (asset: 'USDT' | 'BTC') => {
    setQuoteAsset(asset);
    updatePreferences({ quoteAsset: asset });
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.notLoggedIn}>
          <Icon name="user" size="xl" />
          <p>{locale === 'zh-CN' ? '请先登录' : 'Please sign in first'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>{t.settings?.title || 'Settings'}</h2>
        </div>
        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${activeSection === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveSection('profile')}
          >
            <Icon name="user" size="sm" />
            <span>{t.settings?.categories?.profile || 'Profile'}</span>
          </button>
          <button
            className={`${styles.navItem} ${activeSection === 'security' ? styles.active : ''}`}
            onClick={() => setActiveSection('security')}
          >
            <Icon name="lock" size="sm" />
            <span>{t.settings?.categories?.security || 'Security'}</span>
          </button>
          <button
            className={`${styles.navItem} ${activeSection === 'preferences' ? styles.active : ''}`}
            onClick={() => setActiveSection('preferences')}
          >
            <Icon name="sliders" size="sm" />
            <span>{locale === 'zh-CN' ? '偏好设置' : 'Preferences'}</span>
          </button>
        </nav>
      </div>

      <div className={styles.content}>
        {/* Profile Section */}
        {activeSection === 'profile' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t.settings?.profile?.title || 'Profile'}</h3>
              <p className={styles.sectionDesc}>{t.settings?.profile?.subtitle || 'Manage your account information'}</p>
            </div>

            <div className={styles.card}>
              <div className={styles.avatarSection}>
                <label className={styles.fieldLabel}>{t.settings?.profile?.avatar || 'Avatar'}</label>
                <AvatarUpload
                  currentAvatar={user.avatar}
                  onAvatarChange={updateAvatar}
                  size="lg"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>{t.settings?.profile?.username || 'Username'}</label>
                <input
                  type="text"
                  className={styles.input}
                  value={user.username}
                  disabled
                />
                <span className={styles.fieldHint}>
                  {locale === 'zh-CN' ? '用户名不可修改' : 'Username cannot be changed'}
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>
                  {locale === 'zh-CN' ? '显示名称' : 'Display Name'}
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={locale === 'zh-CN' ? '输入昵称' : 'Enter display name'}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>
                  {locale === 'zh-CN' ? '个人简介' : 'Bio'}
                </label>
                <textarea
                  className={styles.textarea}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={locale === 'zh-CN' ? '介绍一下自己...' : 'Tell us about yourself...'}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>{t.settings?.profile?.timezone || 'Timezone'}</label>
                <select
                  className={styles.select}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="UTC">UTC</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>{t.settings?.profile?.email || 'Email'}</label>
                <input
                  type="text"
                  className={styles.input}
                  value={user.email}
                  disabled
                />
              </div>

              <div className={styles.formActions}>
                <button className={styles.primaryBtn} onClick={handleSaveProfile}>
                  {profileSaved ? (
                    <>
                      <Icon name="check" size="sm" />
                      <span>{t.settings?.common?.saved || 'Saved'}</span>
                    </>
                  ) : (
                    <span>{t.settings?.profile?.saveChanges || 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Section */}
        {activeSection === 'security' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t.settings?.security?.title || 'Security'}</h3>
              <p className={styles.sectionDesc}>{t.settings?.security?.subtitle || 'Protect your account'}</p>
            </div>

            <div className={styles.card}>
              <h4 className={styles.cardTitle}>{t.settings?.security?.changePassword || 'Change Password'}</h4>
              
              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>
                  {locale === 'zh-CN' ? '当前密码' : 'Current Password'}
                </label>
                <input
                  type="password"
                  className={styles.input}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>
                  {locale === 'zh-CN' ? '新密码' : 'New Password'}
                </label>
                <input
                  type="password"
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.fieldLabel}>{t.auth?.confirmPassword || 'Confirm Password'}</label>
                <input
                  type="password"
                  className={styles.input}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {passwordError && (
                <div className={styles.errorMessage}>
                  <Icon name="alert-circle" size="sm" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className={styles.successMessage}>
                  <Icon name="check-circle" size="sm" />
                  <span>{locale === 'zh-CN' ? '密码修改成功' : 'Password changed successfully'}</span>
                </div>
              )}

              <div className={styles.formActions}>
                <button className={styles.primaryBtn} onClick={handleChangePassword}>
                  {t.settings?.security?.changePassword || 'Change Password'}
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h4 className={styles.cardTitle}>
                {locale === 'zh-CN' ? '账户信息' : 'Account Information'}
              </h4>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t.settings?.profile?.accountCreated || 'Account Created'}</span>
                <span className={styles.infoValue}>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t.settings?.profile?.lastLogin || 'Last Login'}</span>
                <span className={styles.infoValue}>{new Date(user.lastLogin).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Preferences Section */}
        {activeSection === 'preferences' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                {locale === 'zh-CN' ? '偏好设置' : 'Preferences'}
              </h3>
              <p className={styles.sectionDesc}>
                {locale === 'zh-CN' ? '自定义您的界面和交易体验' : 'Customize your interface and trading experience'}
              </p>
            </div>

            <div className={styles.card}>
              <h4 className={styles.cardTitle}>{t.settings?.display?.theme || 'Theme'}</h4>
              <div className={styles.optionGroup}>
                <button
                  className={`${styles.optionBtn} ${currentTheme === 'light' ? styles.selected : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <Icon name="sun" size="sm" />
                  <span>{t.settings?.display?.light || 'Light'}</span>
                </button>
                <button
                  className={`${styles.optionBtn} ${currentTheme === 'dark' ? styles.selected : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <Icon name="moon" size="sm" />
                  <span>{t.settings?.display?.dark || 'Dark'}</span>
                </button>
                <button
                  className={`${styles.optionBtn} ${currentTheme === 'system' ? styles.selected : ''}`}
                  onClick={() => handleThemeChange('system')}
                >
                  <Icon name="monitor" size="sm" />
                  <span>{t.settings?.display?.system || 'System'}</span>
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h4 className={styles.cardTitle}>{t.settings?.display?.language || 'Language'}</h4>
              <div className={styles.optionGroup}>
                <button
                  className={`${styles.optionBtn} ${locale === 'zh-CN' ? styles.selected : ''}`}
                  onClick={() => handleLanguageChange('zh-CN')}
                >
                  <span>{t.language?.zh || '中文'}</span>
                </button>
                <button
                  className={`${styles.optionBtn} ${locale === 'en-US' ? styles.selected : ''}`}
                  onClick={() => handleLanguageChange('en-US')}
                >
                  <span>{t.language?.en || 'English'}</span>
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h4 className={styles.cardTitle}>
                {locale === 'zh-CN' ? '默认报价币种' : 'Default Quote Asset'}
              </h4>
              <div className={styles.optionGroup}>
                <button
                  className={`${styles.optionBtn} ${quoteAsset === 'USDT' ? styles.selected : ''}`}
                  onClick={() => handleQuoteAssetChange('USDT')}
                >
                  <span>USDT</span>
                </button>
                <button
                  className={`${styles.optionBtn} ${quoteAsset === 'BTC' ? styles.selected : ''}`}
                  onClick={() => handleQuoteAssetChange('BTC')}
                >
                  <span>BTC</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
