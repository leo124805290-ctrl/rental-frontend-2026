// @ts-nocheck
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { zhTW } from './locales/zh-TW';
import { vi } from './locales/vi';

export type Locale = 'zh-TW' | 'vi';

const translations: Record<Locale, typeof zhTW> = {
  'zh-TW': zhTW,
  vi,
};

interface I18nContextType {
  locale: Locale;
  t: typeof zhTW;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh-TW',
  t: zhTW,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-TW');

  useEffect(() => {
    const saved = localStorage.getItem('app_locale') as Locale;
    if (saved && translations[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('app_locale', newLocale);
  };

  const t = translations[locale];

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({
  className = 'flex items-center gap-1 px-2 py-1 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors',
}: {
  className?: string;
}) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'zh-TW' ? 'vi' : 'zh-TW')}
      className={className}
      title={locale === 'zh-TW' ? 'Chuyển sang Tiếng Việt' : '切換為中文'}
    >
      {locale === 'zh-TW' ? '🇻🇳 Tiếng Việt' : '🇹🇼 中文'}
    </button>
  );
}
