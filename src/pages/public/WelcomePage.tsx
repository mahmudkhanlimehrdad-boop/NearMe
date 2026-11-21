import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NearMeLogo } from '../../components/NearMeLogo';
import { LanguageSelector } from '../../components/LanguageSelector';
import { OfflineIndicator, PWAInstallButton } from '../../components/PWAInstallButton';

export const WelcomePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
      <header className="h-16 px-6 max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <Link to="/">
          <NearMeLogo />
        </Link>
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton compact />
          <LanguageSelector compact />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-xl w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold">{t('welcome.title')}</h1>
            <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
              {t('welcome.subtitle')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#202737]">
              <UserCheck className="w-5 h-5 text-[#FF5277] shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700 dark:text-[#A7AFBF]">{t('welcome.ageNotice')}</p>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#202737]">
              <ShieldCheck className="w-5 h-5 text-[#35C98A] shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700 dark:text-[#A7AFBF]">
                {t('welcome.independentNotice')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/register"
              className="flex-1 py-3 px-5 rounded-xl bg-[#FF5277] text-white text-center text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors"
            >
              {t('welcome.continueRegister')}
            </Link>
            <Link
              to="/login"
              className="flex-1 py-3 px-5 rounded-xl bg-slate-100 dark:bg-[#202737] text-center text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors"
            >
              {t('welcome.alreadyMember')}
            </Link>
          </div>
        </div>
      </main>
      <OfflineIndicator />
    </div>
  );
};
