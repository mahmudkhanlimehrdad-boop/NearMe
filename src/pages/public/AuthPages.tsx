import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type User,
} from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth, googleProvider } from '../../services/firebase';
import { getUserAccount, initializeUserRecords } from '../../services/profileService';
import { isAdult18Plus } from '../../utils/validation';
import { formatLocalizedDate } from '../../utils/localization';
import { useApp } from '../../contexts/AppContext';
import { NearMeLogo } from '../../components/NearMeLogo';
import { LanguageSelector } from '../../components/LanguageSelector';
import type { LanguageCode } from '../../types/nearme';

function formatGoogleAuthError(err: unknown, language: LanguageCode, fallback: string): string {
  const isFa = language === 'fa';
  const code = err instanceof FirebaseError ? err.code : '';
  const msg = err instanceof Error ? err.message : String(err || '');
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
    return isFa
      ? `دامنه فعلی (${host}) در Firebase مجاز نشده است. در Firebase Console به مسیر Authentication → Settings → Authorized domains بروید و دامنه ${host} را اضافه کنید.`
      : `Current domain (${host}) is not authorized in Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/operation-not-allowed' || msg.includes('auth/operation-not-allowed')) {
    return isFa
      ? 'ورود با گوگل در Firebase Console فعال نیست. در مسیر Authentication → Sign-in method گزینه Google را فعال کنید.'
      : 'Google Sign-In is disabled. Enable Google under Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
    return isFa
      ? 'پنجره ورود گوگل توسط مرورگر مسدود شد. لطفاً Pop-up را برای این سایت مجاز کنید یا لینک برنامه را در یک تب جدید باز کنید.'
      : 'Google sign-in popup was blocked by your browser. Allow popups for this site or open the app in a new tab.';
  }
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('popup-closed-by-user')
  ) {
    return isFa
      ? 'پنجره ورود گوگل پیش از تکمیل ورود بسته شد. دوباره تلاش کنید.'
      : 'The Google sign-in window was closed before completing sign-in. Please try again.';
  }
  if (code === 'auth/network-request-failed') {
    return isFa
      ? 'خطا در اتصال شبکه هنگام ارتباط با سرویس احراز هویت گوگل.'
      : 'Network error while connecting to Google authentication.';
  }
  if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
    return isFa
      ? 'احراز هویت گوگل انجام شد، اما دسترسی Firestore هنوز باز نشده است. قوانین فایل firestore.rules را در Firebase Console → Firestore Database → Rules منتشر (Publish) کنید.'
      : 'Google sign-in succeeded, but Firestore blocked profile access. Publish firestore.rules in Firebase Console → Firestore Database → Rules.';
  }
  return msg || fallback;
}

async function completeGoogleSession(params: {
  user: User;
  birthDate: string;
  language: LanguageCode;
  refreshUserData: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  const existing = await getUserAccount(params.user.uid);
  if (!existing) {
    await initializeUserRecords({
      uid: params.user.uid,
      displayName: params.user.displayName || 'NearMe Member',
      birthDate: params.birthDate,
      emailVerified: params.user.emailVerified,
      language: params.language,
    });
  }
  await params.refreshUserData();
  params.navigate(existing?.onboardingCompleted ? '/nearby' : '/onboarding');
}

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, refreshUserData } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('1998-01-01');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age18Confirmed, setAge18Confirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then(async (cred) => {
        if (!active || !cred?.user) return;
        setLoading(true);
        try {
          await completeGoogleSession({
            user: cred.user,
            birthDate,
            language,
            refreshUserData,
            navigate,
          });
        } catch (err) {
          if (active) setError(formatGoogleAuthError(err, language, t('errors.generic')));
        } finally {
          if (active) setLoading(false);
        }
      })
      .catch((err) => {
        if (active) setError(formatGoogleAuthError(err, language, t('errors.generic')));
      });
    return () => {
      active = false;
    };
  }, [birthDate, language, navigate, refreshUserData, t]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim() || !email.trim() || !birthDate) {
      setError(t('errors.required'));
      return;
    }
    if (!age18Confirmed || !isAdult18Plus(birthDate)) {
      setError(t('errors.under18'));
      return;
    }
    if (password.length < 6) {
      setError(t('errors.weakPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      // Backend age verification check
      const ageRes = await fetch('/api/auth/validate-age', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate }),
      });
      if (!ageRes.ok) {
        setError(t('errors.under18'));
        setLoading(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      await sendEmailVerification(cred.user).catch(() => {});

      await initializeUserRecords({
        uid: cred.user.uid,
        displayName: displayName.trim(),
        birthDate,
        emailVerified: cred.user.emailVerified,
        language,
      });

      await refreshUserData();
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    if (!isAdult18Plus(birthDate)) {
      setError(t('errors.under18'));
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await completeGoogleSession({
        user: cred.user,
        birthDate,
        language,
        refreshUserData,
        navigate,
      });
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (code === 'auth/popup-blocked' && !inIframe) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      setError(formatGoogleAuthError(err, language, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
      <header className="h-16 px-6 max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link to="/">
          <NearMeLogo />
        </Link>
        <LanguageSelector compact />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold">{t('auth.registerTitle')}</h1>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                {t('auth.displayName')}
              </label>
              <input
                id="reg-name"
                type="text"
                required
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                {t('auth.email')}
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
              />
            </div>

            <div>
              <label htmlFor="reg-dob" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                {t('auth.birthDate')} ({formatLocalizedDate(birthDate, language)})
              </label>
              <input
                id="reg-dob"
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-pw" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                  {t('auth.password')}
                </label>
                <input
                  id="reg-pw"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                />
              </div>
              <div>
                <label htmlFor="reg-pw2" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  id="reg-pw2"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-[#A7AFBF] cursor-pointer">
              <input
                type="checkbox"
                checked={age18Confirmed}
                onChange={(e) => setAge18Confirmed(e.target.checked)}
                className="mt-0.5 rounded accent-[#FF5277]"
              />
              <span>{t('auth.age18Confirm')}</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50 transition-colors"
            >
              {loading ? t('common.loading') : t('auth.registerBtn')}
            </button>
          </form>

          <button
            type="button"
            disabled={loading}
            aria-busy={loading}
            onClick={handleGoogle}
            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#2a3347] disabled:opacity-60 transition-colors"
          >
            {loading ? t('common.loading') : t('auth.googleSignIn')}
          </button>

          <p className="text-[11px] text-slate-500 dark:text-[#A7AFBF]">{t('auth.phoneNotice')}</p>

          <div className="text-center text-xs text-slate-500 dark:text-[#A7AFBF]">
            <Link to="/login" className="text-[#FF5277] hover:underline">
              {t('welcome.alreadyMember')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, refreshUserData } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then(async (cred) => {
        if (!active || !cred?.user) return;
        setLoading(true);
        try {
          await completeGoogleSession({
            user: cred.user,
            birthDate: '1998-01-01',
            language,
            refreshUserData,
            navigate,
          });
        } catch (err) {
          if (active) setError(formatGoogleAuthError(err, language, t('errors.generic')));
        } finally {
          if (active) setLoading(false);
        }
      })
      .catch((err) => {
        if (active) setError(formatGoogleAuthError(err, language, t('errors.generic')));
      });
    return () => {
      active = false;
    };
  }, [language, navigate, refreshUserData, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const acc = await getUserAccount(cred.user.uid);
      await refreshUserData();
      navigate(acc?.onboardingCompleted ? '/nearby' : '/onboarding');
    } catch (err) {
      setError(formatGoogleAuthError(err, language, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await completeGoogleSession({
        user: cred.user,
        birthDate: '1998-01-01',
        language,
        refreshUserData,
        navigate,
      });
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (code === 'auth/popup-blocked' && !inIframe) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      setError(formatGoogleAuthError(err, language, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
      <header className="h-16 px-6 max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link to="/">
          <NearMeLogo />
        </Link>
        <LanguageSelector compact />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold">{t('auth.loginTitle')}</h1>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                {t('auth.email')}
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-pw" className="text-xs font-medium text-slate-600 dark:text-[#A7AFBF]">
                  {t('auth.password')}
                </label>
                <Link to="/reset-password" className="text-xs text-[#9B7BFF] hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <input
                id="login-pw"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50 transition-colors"
            >
              {loading ? t('common.loading') : t('auth.loginBtn')}
            </button>
          </form>

          <button
            type="button"
            disabled={loading}
            aria-busy={loading}
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#2a3347] disabled:opacity-60 transition-colors"
          >
            {loading ? t('common.loading') : t('auth.googleSignIn')}
          </button>

          <div className="text-center text-xs text-slate-500 dark:text-[#A7AFBF]">
            <Link to="/register" className="text-[#FF5277] hover:underline">
              {t('landing.ctaPrimary')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
      <header className="h-16 px-6 max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link to="/">
          <NearMeLogo />
        </Link>
        <LanguageSelector compact />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold">{t('auth.resetTitle')}</h1>
          {sent && (
            <div className="p-3 rounded-xl bg-[#35C98A]/15 border border-[#35C98A]/30 text-xs text-[#35C98A]">
              {t('auth.resetSent')}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]">
              {error}
            </div>
          )}
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                {t('auth.email')}
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors"
            >
              {t('auth.resetBtn')}
            </button>
          </form>
          <div className="text-center text-xs">
            <Link to="/login" className="text-[#9B7BFF] hover:underline">
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
