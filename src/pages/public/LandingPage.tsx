import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import { NearMeLogo } from '../../components/NearMeLogo';
import { LanguageSelector } from '../../components/LanguageSelector';
import { OfflineIndicator, PWAInstallButton } from '../../components/PWAInstallButton';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, firebaseStatus, theme, toggleTheme } = useApp();

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0D1018]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
          <Link to="/" className="shrink-0">
            <NearMeLogo />
          </Link>

          <nav aria-label="Public navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-[#A7AFBF]">
            <Link to="/welcome" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              {t('nav.welcome')}
            </Link>
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              {t('nav.privacy')}
            </Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              {t('nav.terms')}
            </Link>
            <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              {t('nav.contact')}
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <LanguageSelector compact />
            <Link
              to={firebaseUser ? '/nearby' : '/login'}
              className="px-4 py-2 rounded-xl bg-[#FF5277] text-white text-xs sm:text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors whitespace-nowrap shrink-0"
            >
              {firebaseUser ? t('landing.ctaExplore') : t('landing.ctaSecondary')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium tracking-wide text-[#FF8EAA]">
                {t('landing.kicker')}
              </p>
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.15] text-balance">
                {t('landing.heroTitle')}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-[#A7AFBF] leading-relaxed max-w-xl">
                {t('landing.heroSubtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={firebaseUser ? '/nearby' : '/register'}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors"
                >
                  <span>{firebaseUser ? t('landing.ctaExplore') : t('landing.ctaPrimary')}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </Link>
                <Link
                  to="/welcome"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-sm font-medium hover:bg-slate-50 dark:hover:bg-[#202737] transition-colors"
                >
                  {t('nav.welcome')}
                </Link>
                <PWAInstallButton />
              </div>

              {/* Real Connection Status & Theme Control */}
              <div className="pt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-[#A7AFBF]">
                <span>
                  {firebaseStatus === 'connected'
                    ? t('auth.firebaseConnected')
                    : firebaseStatus === 'checking'
                    ? t('auth.firebaseChecking')
                    : t('auth.firebaseError')}
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="hover:text-slate-900 dark:hover:text-white underline-offset-4 hover:underline"
                >
                  {theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] sm:min-h-[380px] rounded-3xl overflow-hidden bg-[#171C28] border border-slate-200 dark:border-white/10 relative">
                <img
                  src="/src/assets/images/nearme_hero_twilight_1795103947295.jpg"
                  alt="NearMe evening rooftop atmosphere"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D1018]/80 via-[#0D1018]/20 to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#171C28]/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-10">
            <div className="max-w-2xl space-y-3">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-balance">
                {t('landing.sectionArchitectureTitle')}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-[#A7AFBF]">
                {t('landing.sectionArchitectureDesc')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <article className="rounded-2xl bg-[#F6F7FB] dark:bg-[#202737] border border-slate-200 dark:border-white/10 p-6 space-y-3">
                <MapPin className="w-6 h-6 text-[#FF5277]" />
                <h3 className="font-display text-lg font-semibold">{t('landing.cap1Title')}</h3>
                <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                  {t('landing.cap1Desc')}
                </p>
              </article>

              <article className="rounded-2xl bg-[#F6F7FB] dark:bg-[#202737] border border-slate-200 dark:border-white/10 p-6 space-y-3">
                <Lock className="w-6 h-6 text-[#9B7BFF]" />
                <h3 className="font-display text-lg font-semibold">{t('landing.cap2Title')}</h3>
                <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                  {t('landing.cap2Desc')}
                </p>
              </article>

              <article className="rounded-2xl bg-[#F6F7FB] dark:bg-[#202737] border border-slate-200 dark:border-white/10 p-6 space-y-3">
                <MessageCircle className="w-6 h-6 text-[#35C98A]" />
                <h3 className="font-display text-lg font-semibold">{t('landing.cap3Title')}</h3>
                <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                  {t('landing.cap3Desc')}
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Privacy Showcase */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid lg:grid-cols-12 gap-8 items-center rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-10">
            <div className="lg:col-span-5 aspect-[4/3] rounded-2xl overflow-hidden bg-[#202737]">
              <img
                src="/src/assets/images/nearme_compass_empty_1795103946118.jpg"
                alt="NearMe privacy compass"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#35C98A]">
                <ShieldCheck className="w-4 h-4" />
                <span>{t('profile.contactPrivacy')}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-balance">
                {t('landing.sectionPrivacyTitle')}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                {t('landing.sectionPrivacyDesc')}
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-xl bg-[#9B7BFF] text-white text-sm font-semibold hover:bg-[#9B7BFF]/90 transition-colors"
                >
                  {t('landing.ctaPrimary')}
                </Link>
                <Link
                  to="/privacy"
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  {t('nav.privacy')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-white/10 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-[#A7AFBF]">
          <p>{t('landing.footerCopy')}</p>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">{t('nav.terms')}</Link>
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">{t('nav.privacy')}</Link>
            <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">{t('nav.contact')}</Link>
          </div>
        </div>
      </footer>
      <OfflineIndicator />
    </div>
  );
};
