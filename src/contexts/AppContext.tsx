import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  beforeAuthStateChanged,
  getRedirectResult,
  GoogleAuthProvider,
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
  ensureFirestoreDatabaseConfig,
  ensureGmailAuthConfig,
  ensureGoogleAuthConfig,
  getCachedGmailAccessToken,
  logFirebaseAuthError,
  setCachedGmailAccessToken,
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
  redirectTo?: '/nearby' | '/onboarding' | '/gmail';
  error?: GoogleAuthErrorDetail;
}

interface GmailConnectResult {
  ok: boolean;
  error?: GoogleAuthErrorDetail;
}

interface AppContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  firebaseStatus: FirebaseConnectionState;
  lastAuthError: GoogleAuthErrorDetail | null;
  gmailAccessToken: string | null;
  gmailConnected: boolean;
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
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithGmail: (birthDate?: string) => Promise<GoogleSignInResult>;
  signInWithGmailRedirect: () => Promise<void>;
  connectGmail: () => Promise<GmailConnectResult>;
  disconnectGmail: () => void;
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
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(() =>
    getCachedGmailAccessToken()
  );

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
    const dbConfig = ensureFirestoreDatabaseConfig(
      import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
    );
    if (!dbConfig.valid) {
      console.error(
        '[Firebase Firestore][config] Invalid database configuration:',
        dbConfig.issues
      );
      setFirebaseStatus('error');
      return;
    }
    console.info('[Firebase Firestore][config]', {
      projectId: dbConfig.projectId,
      configuredEnvDatabaseId: dbConfig.configuredEnvDatabaseId,
      databaseId: dbConfig.displayDatabaseId,
    });
    void testConnection().then((res) => setFirebaseStatus(res.state));
  }, []);

  const loadUserData = useCallback(async (): Promise<boolean> => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setAccount(null);
      setProfile(null);
      setPreferences(null);
      setSettings(null);
      return true;
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
      return true;
    } catch (err) {
      logFirebaseAuthError('refreshUserData', err);
      setLastAuthError(
        formatGoogleAuthError(err, languageRef.current, 'Failed to load profile from Firestore')
      );
      return false;
    }
  }, []);

  const refreshUserData = useCallback(async (): Promise<void> => {
    await loadUserData();
  }, [loadUserData]);

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

    const authConfig = ensureGoogleAuthConfig();
    if (!authConfig.valid) {
      console.error('[Firebase Auth][config] Invalid Firebase Auth configuration:', authConfig.issues);
    } else {
      console.info('[Firebase Auth][config]', {
        projectId: authConfig.projectId,
        authDomain: authConfig.authDomain,
        providerId: authConfig.provider.providerId,
      });
    }

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
          const loaded = await loadUserData();
          if (active && loaded) {
            setLastAuthError(null);
          }
        } else {
          setCachedGmailAccessToken(null);
          setGmailAccessToken(null);
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
        const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
        if (oauthCred?.accessToken) {
          setCachedGmailAccessToken(oauthCred.accessToken);
          setGmailAccessToken(oauthCred.accessToken);
        }
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
  }, [finalizeGoogleUser, loadUserData]);

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
      const authConfig = ensureGoogleAuthConfig();
      if (!authConfig.valid) {
        const configErr = new Error(
          `Firebase Auth configuration issue: ${authConfig.issues.join('; ')}`
        );
        logFirebaseAuthError('signInWithGoogle.config', configErr);
        const formatted = formatGoogleAuthError(
          configErr,
          languageRef.current,
          'Firebase configuration error'
        );
        setLastAuthError(formatted);
        return { ok: false, error: formatted };
      }

      const { auth: configuredAuth, provider } = authConfig;
      try {
        const hasGoogleSession = Boolean(
          configuredAuth.currentUser?.providerData.some((p) => p.providerId === 'google.com')
        );
        const user =
          hasGoogleSession && configuredAuth.currentUser
            ? configuredAuth.currentUser
            : (await signInWithPopup(configuredAuth, provider)).user;
        const redirectTo = await finalizeGoogleUser(user, birthDate);
        return { ok: true, redirectTo };
      } catch (err) {
        logFirebaseAuthError('signInWithGoogle', err);
        const details = extractFirebaseAuthErrorDetails(err);
        const inIframe = typeof window !== 'undefined' && window.self !== window.top;
        if (details.isPopupBlocked && !inIframe) {
          try {
            await signInWithRedirect(configuredAuth, provider);
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

  const signInWithGmail = useCallback(
    async (birthDate = '1998-01-01'): Promise<GoogleSignInResult> => {
      setLastAuthError(null);
      const authConfig = ensureGmailAuthConfig();
      if (!authConfig.valid) {
        const configErr = new Error(
          `Firebase Auth configuration issue: ${authConfig.issues.join('; ')}`
        );
        logFirebaseAuthError('signInWithGmail.config', configErr);
        const formatted = formatGoogleAuthError(
          configErr,
          languageRef.current,
          'Firebase configuration error'
        );
        setLastAuthError(formatted);
        return { ok: false, error: formatted };
      }

      const { auth: configuredAuth, provider } = authConfig;
      try {
        const result = await signInWithPopup(configuredAuth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setCachedGmailAccessToken(credential.accessToken);
          setGmailAccessToken(credential.accessToken);
        }
        const baseRedirect = await finalizeGoogleUser(result.user, birthDate);
        return {
          ok: true,
          redirectTo: baseRedirect === '/nearby' ? '/gmail' : baseRedirect,
        };
      } catch (err) {
        logFirebaseAuthError('signInWithGmail', err);
        const details = extractFirebaseAuthErrorDetails(err);
        const inIframe = typeof window !== 'undefined' && window.self !== window.top;
        if (details.isPopupBlocked && !inIframe) {
          try {
            await signInWithRedirect(configuredAuth, provider);
            return { ok: false };
          } catch (redirectErr) {
            logFirebaseAuthError('signInWithGmail.redirectFallback', redirectErr);
            const formatted = formatGoogleAuthError(
              redirectErr,
              languageRef.current,
              'Gmail sign-in failed'
            );
            setLastAuthError(formatted);
            return { ok: false, error: formatted };
          }
        }
        const formatted = formatGoogleAuthError(err, languageRef.current, 'Gmail sign-in failed');
        setLastAuthError(formatted);
        return { ok: false, error: formatted };
      }
    },
    [finalizeGoogleUser]
  );

  const connectGmail = useCallback(async (): Promise<GmailConnectResult> => {
    setLastAuthError(null);
    const authConfig = ensureGmailAuthConfig();
    if (!authConfig.valid) {
      const configErr = new Error(
        `Firebase Auth configuration issue: ${authConfig.issues.join('; ')}`
      );
      logFirebaseAuthError('connectGmail.config', configErr);
      const formatted = formatGoogleAuthError(
        configErr,
        languageRef.current,
        'Firebase configuration error'
      );
      setLastAuthError(formatted);
      return { ok: false, error: formatted };
    }

    const { auth: configuredAuth, provider } = authConfig;
    try {
      const result = await signInWithPopup(configuredAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        const tokenErr = new Error('Failed to retrieve Gmail access token.');
        const formatted = formatGoogleAuthError(
          tokenErr,
          languageRef.current,
          'Failed to retrieve Gmail access token'
        );
        setLastAuthError(formatted);
        return { ok: false, error: formatted };
      }
      setCachedGmailAccessToken(credential.accessToken);
      setGmailAccessToken(credential.accessToken);
      await finalizeGoogleUser(result.user);
      return { ok: true };
    } catch (err) {
      logFirebaseAuthError('connectGmail', err);
      const formatted = formatGoogleAuthError(err, languageRef.current, 'Gmail connection failed');
      setLastAuthError(formatted);
      return { ok: false, error: formatted };
    }
  }, [finalizeGoogleUser]);

  const signInWithGoogleRedirect = useCallback(async () => {
    setLastAuthError(null);
    const authConfig = ensureGoogleAuthConfig();
    if (!authConfig.valid) {
      const configErr = new Error(
        `Firebase Auth configuration issue: ${authConfig.issues.join('; ')}`
      );
      logFirebaseAuthError('signInWithGoogleRedirect.config', configErr);
      setLastAuthError(
        formatGoogleAuthError(configErr, languageRef.current, 'Firebase configuration error')
      );
      return;
    }
    try {
      await signInWithRedirect(authConfig.auth, authConfig.provider);
    } catch (err) {
      logFirebaseAuthError('signInWithGoogleRedirect', err);
      setLastAuthError(
        formatGoogleAuthError(err, languageRef.current, 'Google redirect sign-in failed')
      );
    }
  }, []);

  const signInWithGmailRedirect = useCallback(async () => {
    setLastAuthError(null);
    const authConfig = ensureGmailAuthConfig();
    if (!authConfig.valid) {
      const configErr = new Error(
        `Firebase Auth configuration issue: ${authConfig.issues.join('; ')}`
      );
      logFirebaseAuthError('signInWithGmailRedirect.config', configErr);
      setLastAuthError(
        formatGoogleAuthError(configErr, languageRef.current, 'Firebase configuration error')
      );
      return;
    }
    try {
      await signInWithRedirect(authConfig.auth, authConfig.provider);
    } catch (err) {
      logFirebaseAuthError('signInWithGmailRedirect', err);
      setLastAuthError(
        formatGoogleAuthError(err, languageRef.current, 'Gmail redirect sign-in failed')
      );
    }
  }, []);

  const disconnectGmail = useCallback(() => {
    setCachedGmailAccessToken(null);
    setGmailAccessToken(null);
  }, []);

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
    setCachedGmailAccessToken(null);
    setGmailAccessToken(null);
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
        gmailAccessToken,
        gmailConnected: Boolean(gmailAccessToken),
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
        signInWithGoogleRedirect,
        signInWithGmail,
        signInWithGmailRedirect,
        connectGmail,
        disconnectGmail,
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
