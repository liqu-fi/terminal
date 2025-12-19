import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './ThemeToggle.module.css';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => {
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

  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={theme === 'light' ? t.theme.switchToDark : t.theme.switchToLight}
    >
      {theme === 'light' ? <Icon name="moon" size="sm" /> : <Icon name="sun" size="sm" />}
    </button>
  );
}

