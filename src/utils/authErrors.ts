import type { LanguageCode } from '../types/nearme';

export interface GoogleAuthErrorDetail {
  code: string;
  message: string;
  isIframePopupIssue?: boolean;
  isFirestoreRulesIssue?: boolean;
}

export interface FirebaseAuthErrorSummary {
  name: string;
  code: string;
  message: string;
  customData: unknown;
  isPopupClosedByUser: boolean;
  isUnauthorizedDomain: boolean;
  isPopupBlocked: boolean;
}

export function extractFirebaseAuthErrorDetails(err: unknown): FirebaseAuthErrorSummary {
  const errObj = (err && typeof err === 'object' ? err : {}) as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    customData?: unknown;
  };
  const name = typeof errObj.name === 'string' ? errObj.name : 'Error';
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  const message =
    typeof errObj.message === 'string'
      ? errObj.message
      : err instanceof Error
        ? err.message
        : String(err || '');

  return {
    name,
    code,
    message,
    customData: errObj.customData ?? null,
    isPopupClosedByUser:
      code === 'auth/popup-closed-by-user' || message.includes('auth/popup-closed-by-user'),
    isUnauthorizedDomain:
      code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain'),
    isPopupBlocked: code === 'auth/popup-blocked' || message.includes('auth/popup-blocked'),
  };
}

export function formatGoogleAuthError(
  err: unknown,
  language: LanguageCode,
  fallback: string,
  hostnameOverride?: string
): GoogleAuthErrorDetail {
  const isFa = language === 'fa';
  const details = extractFirebaseAuthErrorDetails(err);
  const { code, message: msg } = details;
  const host =
    hostnameOverride ?? (typeof window !== 'undefined' ? window.location.hostname : '');

  if (details.isUnauthorizedDomain) {
    return {
      code: code || 'auth/unauthorized-domain',
      message: isFa
        ? `دامنه فعلی (${host}) در Firebase مجاز نشده است. در Firebase Console به مسیر Authentication → Settings → Authorized domains بروید و دامنه ${host} را اضافه کنید.`
        : `Current domain (${host}) is not authorized in Firebase Console → Authentication → Settings → Authorized domains.`,
    };
  }
  if (code === 'auth/operation-not-allowed' || msg.includes('auth/operation-not-allowed')) {
    return {
      code: code || 'auth/operation-not-allowed',
      message: isFa
        ? 'ورود با گوگل در Firebase Console فعال نیست. در مسیر Authentication → Sign-in method گزینه Google را فعال کنید.'
        : 'Google Sign-In is disabled. Enable Google under Firebase Console → Authentication → Sign-in method.',
    };
  }
  if (
    details.isPopupBlocked ||
    code === 'auth/internal-error' ||
    code === 'auth/web-storage-unsupported' ||
    msg.includes('auth/internal-error')
  ) {
    return {
      code: code || 'auth/popup-blocked',
      isIframePopupIssue: true,
      message: isFa
        ? 'پنجره ورود گوگل در پیش‌نمایش (iframe) مسدود شد یا کوکی/حافظه شخص ثالث در مرورگر محدود است. برای ورود بدون خطا صفحه را در تب جدید باز کنید یا Pop-up را مجاز کنید.'
        : 'Google sign-in popup was blocked or restricted inside the embedded preview. Open sign-in in a new tab or allow popups.',
    };
  }
  if (
    details.isPopupClosedByUser ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('popup-closed-by-user')
  ) {
    return {
      code: code || 'auth/popup-closed-by-user',
      isIframePopupIssue: true,
      message: isFa
        ? 'پنجره ورود گوگل پیش از تکمیل ورود بسته شد. اگر داخل پیش‌نمایش هستید، صفحه را در تب جدید باز کنید و دوباره تلاش کنید.'
        : 'The Google sign-in window closed before completing login. If you are in an embedded preview, try opening in a new tab.',
    };
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return {
      code,
      message: isFa
        ? 'این ایمیل قبلاً با روش دیگری (ایمیل و رمز عبور) ثبت شده است. با ایمیل و رمز عبور وارد شوید.'
        : 'An account already exists with this email using password sign-in. Please sign in with email and password.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      message: isFa
        ? 'خطا در اتصال شبکه هنگام ارتباط با سرویس احراز هویت گوگل.'
        : 'Network error while connecting to Google authentication.',
    };
  }
  if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
    return {
      code: code || 'firestore/permission-denied',
      isFirestoreRulesIssue: true,
      message: isFa
        ? 'احراز هویت گوگل انجام شد، اما دسترسی Firestore هنوز باز نشده است. قوانین فایل firestore.rules را در Firebase Console → Firestore Database → Rules منتشر (Publish) کنید.'
        : 'Google sign-in succeeded, but Firestore blocked profile access. Publish firestore.rules in Firebase Console → Firestore Database → Rules.',
    };
  }
  return { code: code || 'auth/unknown', message: msg || fallback };
}
