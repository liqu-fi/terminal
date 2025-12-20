import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zhCN, type Locale } from './locales/zh-CN';
import { enUS } from './locales/en-US';

export type LocaleKey = 'zh-CN' | 'en-US';

const locales: Record<LocaleKey, Locale> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

interface I18nState {
  locale: LocaleKey;
  setLocale: (locale: LocaleKey) => void;
  t: Locale;
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'zh-CN',
      setLocale: (locale: LocaleKey) => {
        set({ locale, t: locales[locale] });
      },
      t: zhCN,
    }),
    {
      name: 'i18n-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = locales[state.locale];
        }
      },
    }
  )
);

// 模板字符串替换函数
export function formatMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

// 相对时间格式化
export function formatRelativeTime(timestamp: number, t: Locale['time']): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 5000) return t.justNow;
  if (diff < 60000) return t.secondsAgo.replace('{n}', String(Math.floor(diff / 1000)));
  if (diff < 3600000) return t.minutesAgo.replace('{n}', String(Math.floor(diff / 60000)));
  if (diff < 86400000) return t.hoursAgo.replace('{n}', String(Math.floor(diff / 3600000)));
  
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return t.today;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t.yesterday;
  
  return date.toLocaleDateString();
}

// 数字格式化（带单位）
export function formatNumber(value: number, t: Locale['numbers']): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return (value / 1e12).toFixed(2) + t.trillion;
  if (abs >= 1e9) return (value / 1e9).toFixed(2) + t.billion;
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + t.million;
  if (abs >= 1e3) return (value / 1e3).toFixed(2) + t.thousand;
  return value.toFixed(2);
}

export { zhCN, enUS };
export type { Locale };





