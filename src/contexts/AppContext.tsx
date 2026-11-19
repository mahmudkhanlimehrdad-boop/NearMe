import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import type {
  AccountSettings,
  LanguageCode,
  NotificationItem,
  UserAccount,
  UserPreferences,
  UserProfile,
} from '../types/nearme';
import { auth, testConnection, type FirebaseConnectionState } from '../services/firebase';
import {
  getAccountSettings,
  getUserAccount,
  getUserPreferences,
  getUserProfile,
  updateAccountSettings,
} from '../services/profileService';
import { subscribeNotifications } from '../services/matchService';
import { subscribeConversations } from '../services/chatService';
import { setAppLanguage } from '../i18n';
import i18n from '../i18n';

interface MatchCelebrationState {
  matchId: string;
  peerName: string;
  peerPhoto?: string;
}

interface AppContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  firebaseStatus: FirebaseConnectionState;
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
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_KEY = 'nearme_theme';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseConnectionState>('checking');

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
    } catch {
      // Handled gracefully during initial onboarding before docs exist
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshUserData();
      } else {
        setAccount(null);
        setProfile(null);
        setPreferences(null);
        setSettings(null);
        setNotifications([]);
        setUnreadMessagesCount(0);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [refreshUserData]);

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
