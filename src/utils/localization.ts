import type { LanguageCode } from '../types/nearme';

export interface LanguageMeta {
  code: LanguageCode;
  nativeName: string;
  dir: 'rtl' | 'ltr';
  locale: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'fa', nativeName: 'فارسی', dir: 'rtl', locale: 'fa-IR' },
  { code: 'en', nativeName: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'tr', nativeName: 'Türkçe', dir: 'ltr', locale: 'tr-TR' },
  { code: 'ar', nativeName: 'العربية', dir: 'rtl', locale: 'ar-SA' },
  { code: 'zh-CN', nativeName: '简体中文', dir: 'ltr', locale: 'zh-CN' },
  { code: 'zh-TW', nativeName: '繁體中文', dir: 'ltr', locale: 'zh-TW' },
];

export function isRTL(lang: LanguageCode): boolean {
  return lang === 'fa' || lang === 'ar';
}

export function getLanguageMeta(lang: LanguageCode): LanguageMeta {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang) ?? SUPPORTED_LANGUAGES[1];
}

/**
 * Algorithmic Gregorian to Persian (Jalali / Solar Hijri) converter.
 */
export function toJalali(date: Date): { year: number; month: number; day: number } {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1];

  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { year: jy, month: jm, day: jd };
}

const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export function formatLocalizedNumber(value: number, lang: LanguageCode): string {
  const meta = getLanguageMeta(lang);
  try {
    return new Intl.NumberFormat(meta.locale).format(value);
  } catch {
    return String(value);
  }
}

export function formatLocalizedDate(dateInput: Date | string | number, lang: LanguageCode): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  if (lang === 'fa') {
    const j = toJalali(date);
    const dayStr = formatLocalizedNumber(j.day, 'fa');
    const yearStr = formatLocalizedNumber(j.year, 'fa').replace(/٬|,/g, '');
    return `${dayStr} ${PERSIAN_MONTHS[j.month - 1]} ${yearStr}`;
  }

  const meta = getLanguageMeta(lang);
  try {
    return new Intl.DateTimeFormat(meta.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatLocalizedCurrency(amountUsd: number, lang: LanguageCode): string {
  const meta = getLanguageMeta(lang);
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amountUsd);
  } catch {
    return `$${amountUsd.toFixed(2)}`;
  }
}

export function detectBrowserLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return 'en';
  const raw = (navigator.language || 'en').toLowerCase();
  if (raw.startsWith('fa')) return 'fa';
  if (raw.startsWith('ar')) return 'ar';
  if (raw.startsWith('tr')) return 'tr';
  if (raw === 'zh-tw' || raw === 'zh-hk' || raw === 'zh-hant') return 'zh-TW';
  if (raw.startsWith('zh')) return 'zh-CN';
  return 'en';
}
