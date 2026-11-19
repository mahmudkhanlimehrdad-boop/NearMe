import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Calendar, Check, Globe, Moon, ShieldAlert, Sun, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { LanguageSelector } from '../../components/LanguageSelector';
import { auth } from '../../services/firebase';
import { deactivateUserAccount, updateAccountSettings } from '../../services/profileService';
import { markNotificationRead } from '../../services/matchService';
import { formatLocalizedDate, SUPPORTED_LANGUAGES } from '../../utils/localization';

export const LanguageSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, changeLanguage } = useApp();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-[#FF5277]" />
            <h1 className="font-display text-2xl font-bold">{t('profile.languageSettings')}</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUPPORTED_LANGUAGES.map((meta) => {
              const active = language === meta.code;
              return (
                <button
                  key={meta.code}
                  type="button"
                  onClick={() => changeLanguage(meta.code)}
                  className={`p-4 rounded-2xl border text-start flex items-center justify-between transition-colors ${
                    active
                      ? 'border-[#FF5277] bg-[#FF5277]/10'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#202737]'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm">{meta.nativeName}</p>
                    <p className="text-[11px] text-slate-500 dark:text-[#A7AFBF]">
                      {meta.dir.toUpperCase()} · {meta.locale}
                    </p>
                  </div>
                  {active && <Check className="w-4 h-4 text-[#FF5277]" />}
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#202737] flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-[#A7AFBF] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#9B7BFF]" />
              <span>{formatLocalizedDate(new Date(), language)}</span>
            </span>
            <LanguageSelector compact />
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export const AccountSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { firebaseUser, settings, theme, toggleTheme, logout, refreshUserData } = useApp();

  const [resetSent, setResetSent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handlePasswordReset = async () => {
    if (!firebaseUser?.email) return;
    await sendPasswordResetEmail(auth, firebaseUser.email);
    setResetSent(true);
  };

  const handleGdprToggle = async () => {
    if (!firebaseUser) return;
    await updateAccountSettings(firebaseUser.uid, { consentGdpr: !(settings?.consentGdpr ?? true) });
    await refreshUserData();
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await deactivateUserAccount(firebaseUser.uid);
      await logout();
      navigate('/');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold">{t('profile.accountSettings')}</h1>

          {/* Theme */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#202737]">
            <span className="text-sm font-medium">
              {theme === 'dark' ? t('common.themeDark') : t('common.themeLight')}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs font-semibold"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}</span>
            </button>
          </div>

          {/* Password Reset */}
          {firebaseUser?.email && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#202737]">
              <div>
                <p className="text-sm font-medium">{t('auth.resetTitle')}</p>
                <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">{firebaseUser.email}</p>
              </div>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="px-4 py-2 rounded-xl bg-[#9B7BFF] text-white text-xs font-semibold"
              >
                {resetSent ? t('auth.resetSent') : t('auth.resetBtn')}
              </button>
            </div>
          )}

          {/* GDPR */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#202737]">
            <span className="text-sm font-medium">{t('legal.gdprTitle')}</span>
            <button
              type="button"
              onClick={handleGdprToggle}
              className="px-4 py-2 rounded-xl bg-[#35C98A]/20 text-[#35C98A] text-xs font-semibold"
            >
              {settings?.consentGdpr !== false ? t('contacts.enabled') : t('contacts.disabled')}
            </button>
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap gap-4 text-xs text-[#9B7BFF]">
            <Link to="/terms" className="hover:underline">{t('nav.terms')}</Link>
            <Link to="/privacy" className="hover:underline">{t('nav.privacy')}</Link>
            <Link to="/contact" className="hover:underline">{t('nav.contact')}</Link>
          </div>

          {/* Delete Account */}
          <form
            onSubmit={handleDeleteAccount}
            className="p-4 rounded-2xl bg-[#F05265]/10 border border-[#F05265]/25 space-y-3"
          >
            <div className="flex items-center gap-2 text-[#F05265] font-semibold text-sm">
              <ShieldAlert className="w-4 h-4" />
              <span>{t('auth.deleteAccount')}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">
              {t('auth.deleteAccountConfirm')}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs"
              />
              <button
                type="submit"
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F05265] text-white text-xs font-semibold disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('auth.deleteAccount')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
};

export const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, notifications, settings, refreshUserData } = useApp();
  const [pushState, setPushState] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const requestPush = async () => {
    if (!firebaseUser || typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setPushState(perm);
    await updateAccountSettings(firebaseUser.uid, {
      notifications: {
        ...(settings?.notifications ?? {
          matches: true,
          messages: true,
          likes: true,
          verification: true,
          subscriptions: true,
          security: true,
          browserPush: false,
        }),
        browserPush: perm === 'granted',
      },
    });
    await refreshUserData();
  };

  const togglePref = async (key: keyof NonNullable<typeof settings>['notifications']) => {
    if (!firebaseUser || !settings) return;
    await updateAccountSettings(firebaseUser.uid, {
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    });
    await refreshUserData();
  };

  const markAllRead = async () => {
    await Promise.all(
      notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.notificationId))
    );
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">{t('notifications.title')}</h1>
          {notifications.some((n) => !n.read) && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-[#FF5277] hover:underline"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>

        {/* Browser Push Opt-in */}
        <div className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#9B7BFF]" />
              <span>{t('notifications.pushTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">{t('notifications.pushDesc')}</p>
          </div>
          <button
            type="button"
            onClick={requestPush}
            disabled={pushState === 'granted'}
            className="px-4 py-2 rounded-xl bg-[#9B7BFF] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {pushState === 'granted' ? t('contacts.enabled') : t('notifications.enablePush')}
          </button>
        </div>

        {/* Preferences */}
        {settings && (
          <div className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-5 space-y-3">
            <h2 className="text-sm font-bold">{t('notifications.prefsTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(['matches', 'messages', 'likes', 'verification', 'subscriptions', 'security'] as const).map(
                (key) => {
                  const active = settings.notifications?.[key] ?? true;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePref(key)}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#202737] flex items-center justify-between text-xs"
                    >
                      <span>{t(`notifications.types.${key}`)}</span>
                      <span className={active ? 'text-[#35C98A] font-semibold' : 'text-[#A7AFBF]'}>
                        {active ? t('contacts.enabled') : t('contacts.disabled')}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Notification Feed */}
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-[#A7AFBF]">
              {t('notifications.empty')}
            </p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.notificationId}
                to={n.link || '/notifications'}
                onClick={() => !n.read && markNotificationRead(n.notificationId)}
                className={`p-4 flex items-center justify-between gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                  !n.read ? 'bg-[#FF5277]/5' : ''
                }`}
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">{n.body}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#FF5277] shrink-0" />}
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
};
