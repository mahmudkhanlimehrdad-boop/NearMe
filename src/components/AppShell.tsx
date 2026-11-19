import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell,
  Compass,
  Crown,
  Heart,
  MapPin,
  MessageCircle,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sendEmailVerification } from 'firebase/auth';
import { useApp } from '../contexts/AppContext';
import { NearMeLogo } from './NearMeLogo';
import { LanguageSelector } from './LanguageSelector';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    firebaseUser,
    profile,
    account,
    unreadMessagesCount,
    unreadNotificationsCount,
    theme,
    toggleTheme,
    isAdmin,
    matchCelebration,
    setMatchCelebration,
  } = useApp();
  const [verificationSent, setVerificationSent] = React.useState(false);

  const navItems = [
    { path: '/nearby', label: t('nav.nearby'), icon: MapPin, badge: 0 },
    { path: '/discover', label: t('nav.discover'), icon: Compass, badge: 0 },
    { path: '/likes', label: t('nav.likes'), icon: Heart, badge: 0 },
    { path: '/messages', label: t('nav.messages'), icon: MessageCircle, badge: unreadMessagesCount },
    { path: '/profile', label: t('nav.profile'), icon: User, badge: 0 },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    await sendEmailVerification(firebaseUser);
    setVerificationSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 md:start-0 border-e border-slate-200 dark:border-white/10 bg-white dark:bg-[#171C28] z-30">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
          <Link to="/nearby" className="focus:outline-none">
            <NearMeLogo />
          </Link>
        </div>

        <nav aria-label="Main navigation" className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#FF5277]/15 text-[#FF5277]'
                    : 'text-slate-600 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF5277] text-white text-xs font-semibold flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/10 space-y-1.5">
            <Link
              to="/notifications"
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive('/notifications')
                  ? 'bg-[#9B7BFF]/15 text-[#9B7BFF]'
                  : 'text-slate-600 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <Bell className="w-5 h-5 shrink-0" />
                <span>{t('nav.notifications')}</span>
              </span>
              {unreadNotificationsCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#9B7BFF] text-white text-xs font-semibold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>

            <Link
              to="/subscription"
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive('/subscription')
                  ? 'bg-[#FF5277]/15 text-[#FF5277]'
                  : 'text-slate-600 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <Crown className="w-5 h-5 shrink-0 text-amber-400" />
                <span>{t('nav.subscription')}</span>
              </span>
              <span className="text-xs text-slate-400 dark:text-[#A7AFBF]">
                {account?.membershipTier === 'vip' ? 'VIP' : t('subscription.freeName')}
              </span>
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-[#9B7BFF]/15 text-[#9B7BFF]'
                    : 'text-slate-600 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <Shield className="w-5 h-5 shrink-0" />
                <span>{t('nav.admin')}</span>
              </Link>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/10 space-y-3">
          {profile && (
            <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-full bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                {profile.mainPhotoUrl ? (
                  <img
                    src={profile.mainPhotoUrl}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-[#A7AFBF]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{profile.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-[#A7AFBF] truncate">
                  {profile.verificationStatus === 'verified'
                    ? t('profile.verified')
                    : t('profile.unverified')}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <LanguageSelector compact />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
              className="p-2 rounded-lg border border-slate-300 dark:border-white/10 text-slate-600 dark:text-[#A7AFBF] hover:text-slate-900 dark:hover:text-white"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ps-64 lg:ps-72 flex flex-col min-h-screen">
        {/* Compact Mobile Top Bar */}
        <header className="md:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between bg-white/90 dark:bg-[#171C28]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
          <Link to="/nearby">
            <NearMeLogo size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <PWAInstallButton compact />
            <LanguageSelector compact />
            <Link
              to="/notifications"
              aria-label={t('nav.notifications')}
              className="relative p-2 rounded-lg text-slate-600 dark:text-[#A7AFBF]"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-[#FF5277]" />
              )}
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
              className="p-2 rounded-lg text-slate-600 dark:text-[#A7AFBF]"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Email Verification Reminder Banner (Non-blocking) */}
        {firebaseUser && !firebaseUser.emailVerified && (
          <div className="bg-[#9B7BFF]/15 border-b border-[#9B7BFF]/30 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-800 dark:text-white">{t('auth.verifyEmailBanner')}</span>
            <button
              type="button"
              onClick={handleResendVerification}
              className="font-medium text-[#FF5277] hover:underline"
            >
              {verificationSent ? t('auth.verificationSent') : t('auth.resendVerification')}
            </button>
          </div>
        )}

        <main className="flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation (5 primary sections) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#171C28]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center justify-center h-full min-h-[44px] gap-1 text-[10px] font-medium transition-colors ${
                  active ? 'text-[#FF5277]' : 'text-slate-500 dark:text-[#A7AFBF]'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -end-2 min-w-[16px] h-4 px-1 rounded-full bg-[#FF5277] text-white text-[10px] flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-[68px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Match Celebration Modal */}
      {matchCelebration && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
        >
          <div className="max-w-md w-full rounded-3xl bg-[#171C28] border border-white/15 p-8 text-center space-y-5 shadow-2xl">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5277] to-[#9B7BFF] flex items-center justify-center">
              <Heart className="w-10 h-10 text-white fill-white" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              {t('likes.matchCelebrationTitle')}
            </h2>
            <p className="text-sm text-[#A7AFBF]">
              {t('likes.matchCelebrationDesc', { name: matchCelebration.peerName })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to={`/messages/${matchCelebration.matchId}`}
                onClick={() => setMatchCelebration(null)}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors"
              >
                {t('likes.startChat')}
              </Link>
              <button
                type="button"
                onClick={() => setMatchCelebration(null)}
                className="flex-1 py-3 px-4 rounded-xl bg-[#202737] text-white text-sm font-medium hover:bg-[#2a3347] transition-colors"
              >
                {t('likes.keepBrowsing')}
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
};
