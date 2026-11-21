export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export interface ResolvedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  firestoreDatabaseId: string;
}

export interface FirebaseAuthSetupValidation {
  valid: boolean;
  authDomain: string;
  projectId: string;
  issues: string[];
}

function pickProvisionedOrEnv(jsonVal: unknown, envVal: unknown): string {
  const jsonStr = typeof jsonVal === 'string' ? jsonVal.trim() : '';
  if (jsonStr && jsonStr !== 'remixed-project-id') {
    return jsonStr;
  }
  const envStr = typeof envVal === 'string' ? envVal.trim() : '';
  if (envStr && envStr !== 'remixed-project-id') {
    return envStr;
  }
  return '';
}

export function normalizeAuthDomain(rawDomain: string, projectId: string): string {
  const cleaned = rawDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (cleaned) {
    return cleaned;
  }
  return projectId ? `${projectId}.firebaseapp.com` : '';
}

export function normalizeFirestoreDatabaseId(rawDatabaseId: unknown): string {
  if (typeof rawDatabaseId !== 'string') return '';
  const cleaned = rawDatabaseId.trim().replace(/^["']|["']$/g, '').trim();
  if (!cleaned || cleaned === '(default)') {
    return '';
  }
  return cleaned;
}

export function resolveFirebaseConfig(
  appletConfig: FirebaseAppletConfig,
  env: Record<string, unknown> = {}
): ResolvedFirebaseConfig {
  const isAppletProvisioned = Boolean(
    appletConfig.projectId &&
      appletConfig.projectId.trim() &&
      appletConfig.projectId.trim() !== 'remixed-project-id'
  );
  const projectId = pickProvisionedOrEnv(appletConfig.projectId, env.VITE_FIREBASE_PROJECT_ID);
  const rawDbId = isAppletProvisioned
    ? pickProvisionedOrEnv(appletConfig.firestoreDatabaseId, env.VITE_FIREBASE_FIRESTORE_DATABASE_ID)
    : pickProvisionedOrEnv('', env.VITE_FIREBASE_FIRESTORE_DATABASE_ID);

  return {
    apiKey: isAppletProvisioned
      ? pickProvisionedOrEnv(appletConfig.apiKey, env.VITE_FIREBASE_API_KEY)
      : pickProvisionedOrEnv('', env.VITE_FIREBASE_API_KEY),
    authDomain: normalizeAuthDomain(
      isAppletProvisioned
        ? pickProvisionedOrEnv(appletConfig.authDomain, env.VITE_FIREBASE_AUTH_DOMAIN)
        : pickProvisionedOrEnv('', env.VITE_FIREBASE_AUTH_DOMAIN),
      projectId
    ),
    projectId,
    storageBucket: isAppletProvisioned
      ? pickProvisionedOrEnv(appletConfig.storageBucket, env.VITE_FIREBASE_STORAGE_BUCKET)
      : pickProvisionedOrEnv('', env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: isAppletProvisioned
      ? pickProvisionedOrEnv(appletConfig.messagingSenderId, env.VITE_FIREBASE_MESSAGING_SENDER_ID)
      : pickProvisionedOrEnv('', env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: isAppletProvisioned
      ? pickProvisionedOrEnv(appletConfig.appId, env.VITE_FIREBASE_APP_ID)
      : pickProvisionedOrEnv('', env.VITE_FIREBASE_APP_ID),
    measurementId: pickProvisionedOrEnv(
      appletConfig.measurementId,
      env.VITE_FIREBASE_MEASUREMENT_ID
    ),
    firestoreDatabaseId: normalizeFirestoreDatabaseId(rawDbId),
  };
}

export interface FirestoreDatabaseSetupValidation {
  valid: boolean;
  configuredEnvDatabaseId: string;
  sdkDatabaseId: string;
  displayDatabaseId: string;
  projectId: string;
  issues: string[];
}

export function validateFirestoreDatabaseSetup(
  envDatabaseId: unknown,
  dbAppOptions: { projectId?: string },
  expectedConfig: FirebaseAppletConfig
): FirestoreDatabaseSetupValidation {
  const issues: string[] = [];
  const configuredEnvDatabaseId =
    typeof envDatabaseId === 'string'
      ? envDatabaseId.trim().replace(/^["']|["']$/g, '').trim()
      : '';
  const provisionedDbId = normalizeFirestoreDatabaseId(expectedConfig.firestoreDatabaseId || '');
  const sdkDatabaseId = provisionedDbId || normalizeFirestoreDatabaseId(configuredEnvDatabaseId);
  const displayDatabaseId = sdkDatabaseId || '(default)';
  const projectId = (dbAppOptions.projectId || '').trim();

  if (!projectId || projectId === 'remixed-project-id') {
    issues.push('Missing or placeholder Firestore projectId');
  } else if (expectedConfig.projectId && projectId !== expectedConfig.projectId.trim()) {
    issues.push(`Firestore projectId (${projectId}) does not match ${expectedConfig.projectId}`);
  }

  if (
    !provisionedDbId &&
    configuredEnvDatabaseId &&
    configuredEnvDatabaseId !== '(default)' &&
    /\s/.test(configuredEnvDatabaseId)
  ) {
    issues.push('VITE_FIREBASE_FIRESTORE_DATABASE_ID contains invalid whitespace');
  }

  return {
    valid: issues.length === 0,
    configuredEnvDatabaseId: provisionedDbId || configuredEnvDatabaseId || '(default)',
    sdkDatabaseId,
    displayDatabaseId,
    projectId,
    issues,
  };
}

export function validateFirebaseAuthSetup(
  appOptions: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    appId?: string;
  },
  expectedConfig: FirebaseAppletConfig
): FirebaseAuthSetupValidation {
  const issues: string[] = [];
  const apiKey = (appOptions.apiKey || '').trim();
  const projectId = (appOptions.projectId || '').trim();
  const authDomain = (appOptions.authDomain || '').trim();
  const expectedAuthDomain = normalizeAuthDomain(
    expectedConfig.authDomain || '',
    expectedConfig.projectId
  );

  if (!apiKey) {
    issues.push('Missing Firebase apiKey');
  } else if (expectedConfig.apiKey && apiKey !== expectedConfig.apiKey.trim()) {
    issues.push('Firebase apiKey does not match firebase-applet-config.json');
  }

  if (!projectId || projectId === 'remixed-project-id') {
    issues.push('Missing or placeholder Firebase projectId');
  } else if (expectedConfig.projectId && projectId !== expectedConfig.projectId.trim()) {
    issues.push('Firebase projectId does not match firebase-applet-config.json');
  }

  if (!authDomain) {
    issues.push('Missing Firebase authDomain');
  } else if (authDomain.includes('://') || authDomain.includes('/')) {
    issues.push('Firebase authDomain must be a bare hostname without protocol or path');
  } else if (expectedAuthDomain && authDomain !== expectedAuthDomain) {
    issues.push(`Firebase authDomain (${authDomain}) does not match ${expectedAuthDomain}`);
  }

  if (!appOptions.appId?.trim()) {
    issues.push('Missing Firebase appId');
  }

  return {
    valid: issues.length === 0,
    authDomain,
    projectId,
    issues,
  };
}
