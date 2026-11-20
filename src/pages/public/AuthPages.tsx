import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth, logFirebaseAuthError } from '../../services/firebase';
import { getUserAccount, initializeUserRecords } from '../../services/profileService';
import { isAdult18Plus } from '../../utils/validation';
import { formatGoogleAuthError, type GoogleAuthErrorDetail } from '../../utils/authErrors';
import { formatLocalizedDate } from '../../utils/localization';
import { useApp } from '../../contexts/AppContext';
import { NearMeLogo } from '../../components/NearMeLogo';
import { LanguageSelector } from '../../components/LanguageSelector';

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    firebaseUser,
    account,
    language,
    lastAuthError,
    refreshUserData,
    signInWithGoogle,
    clearLastAuthError,
  } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('1998-01-01');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age18Confirmed, setAge18Confirmed] = useState(false);
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState<GoogleAuthErrorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (firebaseUser && account) {
      navigate(account.onboardingCompleted ? '/nearby' : '/onboarding', { replace: true });
    }
  }, [firebaseUser, account, navigate]);

  useEffect(() => {
    if (lastAuthError) {
      setGoogleError(lastAuthError);
    }
  }, [lastAuthError]);

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
      logFirebaseAuthError('RegisterPage.handleRegister', err);
      setError(formatGoogleAuthError(err, language, t('errors.generic')).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleError(null);
    clearLastAuthError();
    if (!isAdult18Plus(birthDate)) {
      const msg = t('errors.under18');
      setError(msg);
      setGoogleError({ code: 'validation/under18', message: msg });
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithGoogle(birthDate);
      if (res.ok && res.redirectTo) {
        navigate(res.redirectTo);
      } else if (res.error) {
        setGoogleError(res.error);
      }
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

          {googleError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265] space-y-2"
            >
              <p>{googleError.message}</p>
              {googleError.isIframePopupIssue &&
                typeof window !== 'undefined' &&
                window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-semibold underline"
                  >
                    {language === 'fa'
                      ? 'باز کردن صفحه در تب جدید'
                      : 'Open sign-in in a new tab'}
                  </a>
                )}
            </div>
          )}

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
  const {
    firebaseUser,
    account,
    language,
    lastAuthError,
    refreshUserData,
    signInWithGoogle,
    clearLastAuthError,
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState<GoogleAuthErrorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (firebaseUser && account) {
      navigate(account.onboardingCompleted ? '/nearby' : '/onboarding', { replace: true });
    }
  }, [firebaseUser, account, navigate]);

  useEffect(() => {
    if (lastAuthError) {
      setGoogleError(lastAuthError);
    }
  }, [lastAuthError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGoogleError(null);
    clearLastAuthError();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const acc = await getUserAccount(cred.user.uid);
      await refreshUserData();
      navigate(acc?.onboardingCompleted ? '/nearby' : '/onboarding');
    } catch (err) {
      logFirebaseAuthError('LoginPage.handleLogin', err);
      setError(formatGoogleAuthError(err, language, t('errors.generic')).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleError(null);
    clearLastAuthError();
    setLoading(true);
    try {
      const res = await signInWithGoogle('1998-01-01');
      if (res.ok && res.redirectTo) {
        navigate(res.redirectTo);
      } else if (res.error) {
        setGoogleError(res.error);
      }
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

          {googleError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265] space-y-2"
            >
              <p>{googleError.message}</p>
              {googleError.isIframePopupIssue &&
                typeof window !== 'undefined' &&
                window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-semibold underline"
                  >
                    {language === 'fa'
                      ? 'باز کردن صفحه در تب جدید'
                      : 'Open sign-in in a new tab'}
                  </a>
                )}
            </div>
          )}

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
