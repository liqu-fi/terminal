import { useState } from 'react';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MobileAccountPage } from './mobile';
import styles from './SettingsPage.module.css';

type SettingsSection = 'preferences';

export function SettingsPage() {
  const isMobile = useIsMobile();
  const { t, locale, setLocale } = useI18n();

  const [_activeSection, _setActiveSection] = useState<SettingsSection>('preferences');
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'dark';
  });

  if (isMobile) {
    return <MobileAccountPage />;
  }

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setCurrentTheme(theme);
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
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>{t.settings?.title || 'Settings'}</h2>
        </div>
        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${styles.active}`}
          >
            <Icon name="sliders" size="sm" />
            <span>{locale === 'zh-CN' ? '偏好设置' : 'Preferences'}</span>
          </button>
        </nav>
      </div>

      <div className={styles.content}>
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
        </div>
      </div>
    </div>
  );
}
