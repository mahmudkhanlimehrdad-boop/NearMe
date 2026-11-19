import React from 'react';
import { Globe } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { LanguageCode } from '../types/nearme';
import { SUPPORTED_LANGUAGES } from '../utils/localization';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, changeLanguage } = useApp();

  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#A7AFBF]">
      <Globe className="w-4 h-4 text-[#9B7BFF] shrink-0" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={language}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        className={`bg-transparent border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9B7BFF] ${
          compact ? 'max-w-[105px]' : ''
        }`}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            className="bg-white text-slate-900 dark:bg-[#171C28] dark:text-white"
          >
            {lang.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
};
