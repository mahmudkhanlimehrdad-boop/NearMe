import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { extractFirebaseAuthErrorDetails } from '../utils/authErrors';
import {
  resolveFirebaseConfig,
  validateFirebaseAuthSetup,
  validateFirestoreDatabaseSetup,
  type FirebaseAuthSetupValidation,
  type FirestoreDatabaseSetupValidation,
} from '../utils/firebaseConfig';
import { GMAIL_SCOPES } from '../utils/gmail';

const firebaseConfig = resolveFirebaseConfig(
  firebaseConfigJson,
  import.meta.env as Record<string, unknown>
);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId !== 'remixed-project-id'
);

const app = initializeApp(firebaseConfig);

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  void isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      analytics = null;
    });
}

export function createGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function createGmailAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  for (const scope of GMAIL_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'consent select_account' });
  return provider;
}

export const auth: Auth = getAuth(app);
export const googleProvider: GoogleAuthProvider = createGoogleAuthProvider();
export const gmailProvider: GoogleAuthProvider = createGmailAuthProvider();

// In-memory-only Gmail OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;

export function getCachedGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function setCachedGmailAccessToken(token: string | null): void {
  cachedGmailAccessToken = token;
}

export function ensureGoogleAuthConfig(): FirebaseAuthSetupValidation & {
  auth: Auth;
  provider: GoogleAuthProvider;
} {
  const expectedAuthDomain = firebaseConfig.authDomain;
  if (expectedAuthDomain && auth.config && auth.config.authDomain !== expectedAuthDomain) {
    auth.config.authDomain = expectedAuthDomain;
  }

  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const validation = validateFirebaseAuthSetup(
    {
      apiKey: auth.app.options.apiKey,
      authDomain: auth.config?.authDomain || auth.app.options.authDomain,
      projectId: auth.app.options.projectId,
      appId: auth.app.options.appId,
    },
    firebaseConfigJson
  );

  return {
    ...validation,
    auth,
    provider: googleProvider,
  };
}

export function ensureGmailAuthConfig(): FirebaseAuthSetupValidation & {
  auth: Auth;
  provider: GoogleAuthProvider;
} {
  const base = ensureGoogleAuthConfig();
  gmailProvider.setCustomParameters({ prompt: 'consent select_account' });
  return {
    ...base,
    provider: gmailProvider,
  };
}

export const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export function ensureFirestoreDatabaseConfig(
  envDatabaseId: unknown = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
): FirestoreDatabaseSetupValidation {
  return validateFirestoreDatabaseSetup(
    envDatabaseId,
    { projectId: db.app.options.projectId },
    firebaseConfigJson
  );
}

export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type FirebaseConnectionState = 'checking' | 'connected' | 'offline' | 'error';

export async function testConnection(): Promise<{ state: FirebaseConnectionState; message?: string }> {
  if (!isFirebaseConfigured) {
    return { state: 'error', message: 'Firebase configuration missing' };
  }
  const dbValidation = ensureFirestoreDatabaseConfig(
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
  );
  if (!dbValidation.valid) {
    return { state: 'error', message: dbValidation.issues.join('; ') };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { state: 'connected' };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const message = error instanceof Error ? error.message : String(error || '');
    if (
      code === 'not-found' ||
      code === 'invalid-argument' ||
      message.toLowerCase().includes('database') && message.toLowerCase().includes('not found')
    ) {
      console.error('[Firebase Firestore][testConnection] Database configuration error:', error);
      return { state: 'error', message };
    }
    if (message.includes('the client is offline') || code === 'unavailable') {
      console.error('Please check your Firebase configuration.');
      return { state: 'offline', message };
    }
    return { state: 'connected' };
  }
}

export function logFirebaseAuthError(stage: string, err: unknown): void {
  const details = extractFirebaseAuthErrorDetails(err);
  const category = details.isPopupClosedByUser
    ? 'auth/popup-closed-by-user'
    : details.isUnauthorizedDomain
      ? 'auth/unauthorized-domain'
      : details.code || 'auth/error';

  console.error(
    `[Firebase Auth][${stage}] ${category}:`,
    {
      ...details,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      inIframe: typeof window !== 'undefined' ? window.self !== window.top : false,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    },
    err
  );
}

export { app, firebaseConfig };
