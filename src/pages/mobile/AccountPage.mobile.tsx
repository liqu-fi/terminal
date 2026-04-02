import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MobileHeader } from '../../components/Layout';
import { MobileActionSheet } from '../../components/mobile';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import styles from './AccountPage.mobile.module.css';

export function MobileAccountPage() {
  const { t, locale, setLocale } = useI18n();
  const { trigger } = useHapticFeedback();

  const [showLangSheet, setShowLangSheet] = useState(false);
  const [showThemeSheet, setShowThemeSheet] = useState(false);

  const toggleTheme = (theme: string) => {
    trigger('selection');
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
    setShowThemeSheet(false);
  };

  const changeLang = (lang: 'zh-CN' | 'en-US') => {
    trigger('selection');
    setLocale(lang);
    setShowLangSheet(false);
  };

  return (
    <div className={styles.container}>
      <MobileHeader
        title={t.nav?.account || 'Account'}
        showActions={false}
      />

      <div className={styles.scrollContent}>
        <div className={styles.section}>
          <div className={styles.listGroup}>
            <button className={styles.listItem} onClick={() => setShowLangSheet(true)}>
              <div className={styles.itemLeft}>
                <Icon name="languages" size="sm" className={styles.itemIcon} />
                <span>{t.language?.label || 'Language'}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemValue}>{locale === 'zh-CN' ? '简体中文' : 'English'}</span>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
            <button className={styles.listItem} onClick={() => setShowThemeSheet(true)}>
              <div className={styles.itemLeft}>
                <Icon name="moon" size="sm" className={styles.itemIcon} />
                <span>{t.settings?.display?.theme || 'Theme'}</span>
              </div>
              <div className={styles.itemRight}>
                <Icon name="chevron-right" size="xs" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <MobileActionSheet
        isOpen={showLangSheet}
        onClose={() => setShowLangSheet(false)}
        title={t.account?.selectLanguage || 'Select Language'}
        actions={[
          { id: 'zh-CN', label: '简体中文' },
          { id: 'en-US', label: 'English' }
        ]}
        onAction={(id) => changeLang(id as 'zh-CN' | 'en-US')}
      />

      <MobileActionSheet
        isOpen={showThemeSheet}
        onClose={() => setShowThemeSheet(false)}
        title={t.account?.selectTheme || 'Select Theme'}
        actions={[
          { id: 'light', label: t.settings?.display?.light || 'Light', icon: 'sun' },
          { id: 'dark', label: t.settings?.display?.dark || 'Dark', icon: 'moon' },
          { id: 'system', label: t.settings?.display?.system || 'System', icon: 'monitor' }
        ]}
        onAction={(id) => toggleTheme(id)}
      />
    </div>
  );
}
