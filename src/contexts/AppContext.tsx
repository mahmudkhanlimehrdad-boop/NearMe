import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  beforeAuthStateChanged,
  getRedirectResult,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import type {
  AccountSettings,
  LanguageCode,
  NotificationItem,
  UserAccount,
  UserPreferences,
  UserProfile,
} from '../types/nearme';
import {
  auth,
  googleProvider,
  logFirebaseAuthError,
  testConnection,
  type FirebaseConnectionState,
} from '../services/firebase';
import {
  getAccountSettings,
  getUserAccount,
  getUserPreferences,
  getUserProfile,
  initializeUserRecords,
  updateAccountSettings,
} from '../services/profileService';
import { subscribeNotifications } from '../services/matchService';
import { subscribeConversations } from '../services/chatService';
import {
  extractFirebaseAuthErrorDetails,
  formatGoogleAuthError,
  type GoogleAuthErrorDetail,
} from '../utils/authErrors';
import { setAppLanguage } from '../i18n';
import i18n from '../i18n';

interface MatchCelebrationState {
  matchId: string;
  peerName: string;
  peerPhoto?: string;
}

interface GoogleSignInResult {
  ok: boolean;
  redirectTo?: '/nearby' | '/onboarding';
  error?: GoogleAuthErrorDetail;
}

interface AppContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  firebaseStatus: FirebaseConnectionState;
  lastAuthError: GoogleAuthErrorDetail | null;
  account: UserAccount | null;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  settings: AccountSettings | null;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  language: LanguageCode;
  theme: 'dark' | 'light';
  isAdmin: boolean;
  matchCelebration: MatchCelebrationState | null;
  setMatchCelebration: (val: MatchCelebrationState | null) => void;
  changeLanguage: (lang: LanguageCode) => void;
  toggleTheme: () => void;
  refreshUserData: () => Promise<void>;
  signInWithGoogle: (birthDate?: string) => Promise<GoogleSignInResult>;
  clearLastAuthError: () => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_KEY = 'nearme_theme';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseConnectionState>('checking');
  const [lastAuthError, setLastAuthError] = useState<GoogleAuthErrorDetail | null>(null);

  const [account, setAccount] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [settings, setSettings] = useState<AccountSettings | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [matchCelebration, setMatchCelebration] = useState<MatchCelebrationState | null>(null);

  const [language, setLanguage] = useState<LanguageCode>(
    (i18n.language as LanguageCode) || 'en'
  );
  const languageRef = useRef<LanguageCode>(language);
  languageRef.current = language;

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    void testConnection().then((res) => setFirebaseStatus(res.state));
  }, []);

  const refreshUserData = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setAccount(null);
      setProfile(null);
      setPreferences(null);
      setSettings(null);
      return;
    }
    try {
      const [acc, prof, prefs, sett] = await Promise.all([
        getUserAccount(uid),
        getUserProfile(uid),
        getUserPreferences(uid),
        getAccountSettings(uid),
      ]);
      setAccount(acc);
      setProfile(prof);
      setPreferences(prefs);
      setSettings(sett);
      if (sett?.preferredLanguage) {
        setLanguage(sett.preferredLanguage);
        setAppLanguage(sett.preferredLanguage);
      }
      if (sett?.theme) {
        setTheme(sett.theme);
      }
    } catch (err) {
      logFirebaseAuthError('refreshUserData', err);
    }
  }, []);

  const finalizeGoogleUser = useCallback(
    async (user: User, birthDate = '1998-01-01'): Promise<'/nearby' | '/onboarding'> => {
      const existing = await getUserAccount(user.uid);
      if (!existing) {
        await initializeUserRecords({
          uid: user.uid,
          displayName: user.displayName || 'NearMe Member',
          birthDate,
          emailVerified: user.emailVerified,
          language: languageRef.current,
        });
      }
      await refreshUserData();
      return existing?.onboardingCompleted ? '/nearby' : '/onboarding';
    },
    [refreshUserData]
  );

  // Comprehensive Firebase Authentication event listeners & redirect completion
  useEffect(() => {
    let active = true;

    auth
      .authStateReady()
      .then(() => {
        if (!active) return;
        console.info('[Firebase Auth][authStateReady]', {
          authenticated: Boolean(auth.currentUser),
          uid: auth.currentUser?.uid ?? null,
          providers: auth.currentUser?.providerData.map((p) => p.providerId) ?? [],
        });
      })
      .catch((err) => {
        logFirebaseAuthError('authStateReady', err);
      });

    const unsubBeforeAuth = beforeAuthStateChanged(
      auth,
      (pendingUser) => {
        console.info('[Firebase Auth][beforeAuthStateChanged]', {
          uid: pendingUser?.uid ?? null,
          email: pendingUser?.email ?? null,
        });
      },
      () => {
        console.warn('[Firebase Auth][beforeAuthStateChanged] aborted');
      }
    );

    const unsubAuthState = onAuthStateChanged(
      auth,
      async (user) => {
        if (!active) return;
        console.info('[Firebase Auth][onAuthStateChanged]', {
          authenticated: Boolean(user),
          uid: user?.uid ?? null,
          emailVerified: user?.emailVerified ?? false,
          providers: user?.providerData.map((p) => p.providerId) ?? [],
        });
        setFirebaseUser(user);
        if (user) {
          setLastAuthError(null);
          await refreshUserData();
        } else {
          setAccount(null);
          setProfile(null);
          setPreferences(null);
          setSettings(null);
          setNotifications([]);
          setUnreadMessagesCount(0);
        }
        if (active) setAuthLoading(false);
      },
      (authErr) => {
        logFirebaseAuthError('onAuthStateChanged', authErr);
        if (active) {
          setLastAuthError(
            formatGoogleAuthError(authErr, languageRef.current, 'Authentication state error')
          );
          setAuthLoading(false);
        }
      }
    );

    const unsubIdToken = onIdTokenChanged(
      auth,
      (user) => {
        console.info('[Firebase Auth][onIdTokenChanged]', {
          uid: user?.uid ?? null,
        });
      },
      (tokenErr) => {
        logFirebaseAuthError('onIdTokenChanged', tokenErr);
        if (active) {
          setLastAuthError(
            formatGoogleAuthError(tokenErr, languageRef.current, 'Authentication token error')
          );
        }
      }
    );

    void getRedirectResult(auth)
      .then(async (cred) => {
        if (!active || !cred?.user) return;
        console.info('[Firebase Auth][getRedirectResult] Google redirect succeeded', {
          uid: cred.user.uid,
          email: cred.user.email,
        });
        try {
          await finalizeGoogleUser(cred.user);
        } catch (err) {
          logFirebaseAuthError('getRedirectResult.finalize', err);
          if (active) {
            setLastAuthError(
              formatGoogleAuthError(err, languageRef.current, 'Failed to initialize profile')
            );
          }
        }
      })
      .catch((err) => {
        logFirebaseAuthError('getRedirectResult', err);
        if (active) {
          setLastAuthError(
            formatGoogleAuthError(err, languageRef.current, 'Google redirect sign-in failed')
          );
        }
      });

    return () => {
      active = false;
      unsubBeforeAuth();
      unsubAuthState();
      unsubIdToken();
    };
  }, [finalizeGoogleUser, refreshUserData]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubNotifs = subscribeNotifications(firebaseUser.uid, (items) => {
      setNotifications(items);
    });
    const unsubConvs = subscribeConversations(firebaseUser.uid, (convs) => {
      let total = 0;
      for (const c of convs) {
        total += c.userA === firebaseUser.uid ? c.unreadA || 0 : c.unreadB || 0;
      }
      setUnreadMessagesCount(total);
    });
    return () => {
      unsubNotifs();
      unsubConvs();
    };
  }, [firebaseUser]);

  const signInWithGoogle = useCallback(
    async (birthDate = '1998-01-01'): Promise<GoogleSignInResult> => {
      setLastAuthError(null);
      try {
        const user = auth.currentUser ?? (await signInWithPopup(auth, googleProvider)).user;
        const redirectTo = await finalizeGoogleUser(user, birthDate);
        return { ok: true, redirectTo };
      } catch (err) {
        logFirebaseAuthError('signInWithGoogle', err);
        const details = extractFirebaseAuthErrorDetails(err);
        const inIframe = typeof window !== 'undefined' && window.self !== window.top;
        if (details.isPopupBlocked && !inIframe) {
          try {
            await signInWithRedirect(auth, googleProvider);
            return { ok: false };
          } catch (redirectErr) {
            logFirebaseAuthError('signInWithGoogle.redirectFallback', redirectErr);
            const formatted = formatGoogleAuthError(
              redirectErr,
              languageRef.current,
              'Google sign-in failed'
            );
            setLastAuthError(formatted);
            return { ok: false, error: formatted };
          }
        }
        const formatted = formatGoogleAuthError(err, languageRef.current, 'Google sign-in failed');
        setLastAuthError(formatted);
        return { ok: false, error: formatted };
      }
    },
    [finalizeGoogleUser]
  );

  const clearLastAuthError = useCallback(() => {
    setLastAuthError(null);
  }, []);

  const changeLanguage = useCallback(
    (lang: LanguageCode) => {
      setLanguage(lang);
      setAppLanguage(lang);
      if (firebaseUser) {
        void updateAccountSettings(firebaseUser.uid, { preferredLanguage: lang }).catch(() => {});
      }
    },
    [firebaseUser]
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (firebaseUser) {
        void updateAccountSettings(firebaseUser.uid, { theme: next }).catch(() => {});
      }
      return next;
    });
  }, [firebaseUser]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const isAdmin = Boolean(
    account?.role === 'admin' ||
      (firebaseUser?.email === 'mahmudkhanlimehrdad@gmail.com' && firebaseUser?.emailVerified)
  );

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        authLoading,
        firebaseStatus,
        lastAuthError,
        account,
        profile,
        preferences,
        settings,
        notifications,
        unreadNotificationsCount,
        unreadMessagesCount,
        language,
        theme,
        isAdmin,
        matchCelebration,
        setMatchCelebration,
        changeLanguage,
        toggleTheme,
        refreshUserData,
        signInWithGoogle,
        clearLastAuthError,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
