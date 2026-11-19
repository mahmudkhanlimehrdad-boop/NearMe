import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import type { PaymentRecord, SubscriptionRecord } from '../types/nearme';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface BackendConfigStatus {
  paymentConfigured: boolean;
  missingCredentials: string[];
  adminBootstrapConfigured: boolean;
  fcmVapidConfigured: boolean;
}

export async function getBackendConfigStatus(): Promise<BackendConfigStatus> {
  try {
    const res = await fetch('/api/config/status');
    if (!res.ok) throw new Error('Config status failed');
    return (await res.json()) as BackendConfigStatus;
  } catch {
    return {
      paymentConfigured: false,
      missingCredentials: ['PAYMENT_PROVIDER_SECRET', 'PAYMENT_WEBHOOK_SECRET'],
      adminBootstrapConfigured: false,
      fcmVapidConfigured: Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY),
    };
  }
}

export async function getUserSubscription(uid: string): Promise<SubscriptionRecord | null> {
  const path = `subscriptions/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'subscriptions', uid));
    return snap.exists() ? (snap.data() as SubscriptionRecord) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getPaymentHistory(uid: string): Promise<PaymentRecord[]> {
  const path = 'payments';
  try {
    const snap = await getDocs(
      query(collection(db, 'payments'), where('uid', '==', uid), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map((d) => d.data() as PaymentRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createCheckoutSession(
  idToken: string,
  plan: 'monthly' | 'quarterly' | 'annual'
): Promise<{ ok: boolean; checkoutUrl?: string; error?: string; missingCredentials?: string[] }> {
  const res = await fetch('/api/payments/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ plan }),
  });
  return (await res.json()) as {
    ok: boolean;
    checkoutUrl?: string;
    error?: string;
    missingCredentials?: string[];
  };
}
