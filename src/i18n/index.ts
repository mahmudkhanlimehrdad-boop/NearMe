import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LanguageCode } from '../types/nearme';
import { detectBrowserLanguage, getLanguageMeta } from '../utils/localization';
import { en } from './translations/en';
import { fa } from './translations/fa';
import { tr } from './translations/tr';
import { ar } from './translations/ar';
import { zhCN } from './translations/zhCN';
import { zhTW } from './translations/zhTW';

const STORAGE_KEY = 'nearme_lang';

function resolveInitialLanguage(): LanguageCode {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved && ['fa', 'en', 'tr', 'ar', 'zh-CN', 'zh-TW'].includes(saved)) {
      return saved;
    }
  }
  return detectBrowserLanguage();
}

export function applyDocumentLanguageAttributes(lang: LanguageCode) {
  if (typeof document === 'undefined') return;
  const meta = getLanguageMeta(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = meta.dir;
  document.documentElement.setAttribute('data-lang', lang);
}

const initialLang = resolveInitialLanguage();
applyDocumentLanguageAttributes(initialLang);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
    tr: { translation: tr },
    ar: { translation: ar },
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLanguage(lang: LanguageCode) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }
  applyDocumentLanguageAttributes(lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
