import * as admin from 'firebase-admin';
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as crypto from 'crypto';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

admin.initializeApp();
const db = admin.firestore();

const PAYMENT_PROVIDER_SECRET = defineSecret('PAYMENT_PROVIDER_SECRET');
const PAYMENT_WEBHOOK_SECRET = defineSecret('PAYMENT_WEBHOOK_SECRET');

type Visibility = 'public' | 'matches' | 'private';
type ContactMethod = 'instagram' | 'telegram' | 'whatsapp' | 'website' | 'email' | 'mobile';

function makePairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function sanitizeContactValue(method: ContactMethod, raw: string): string {
  const cleaned = raw.replace(/[<>]/g, '').trim().slice(0, 300);
  if (!cleaned || /^(javascript|data|vbscript|file):/i.test(cleaned)) {
    throw new HttpsError('invalid-argument', 'Unsafe or empty contact value');
  }
  if (method === 'website' && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(cleaned)) {
    throw new HttpsError('invalid-argument', 'HTTPS website URL required');
  }
  if (method === 'email' && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) {
    throw new HttpsError('invalid-argument', 'Invalid email address');
  }
  return cleaned;
}

export const getAuthorizedProfileContacts = onCall(async (request) => {
  const viewerUid = request.auth?.uid;
  if (!viewerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const profileOwnerUid = String(request.data?.profileOwnerUid || '');
  if (!profileOwnerUid) {
    throw new HttpsError('invalid-argument', 'profileOwnerUid is required');
  }

  // Check bidirectional blocks
  const [b1, b2] = await Promise.all([
    db.doc(`blocked_users/${viewerUid}_${profileOwnerUid}`).get(),
    db.doc(`blocked_users/${profileOwnerUid}_${viewerUid}`).get(),
  ]);
  if (b1.exists || b2.exists) {
    return { contacts: {}, isMutualMatch: false, isBlocked: true };
  }

  const contactSnap = await db.doc(`users/${profileOwnerUid}/private_data/contact_information`).get();
  if (!contactSnap.exists) {
    return { contacts: {}, isMutualMatch: false, isBlocked: false };
  }

  const info = contactSnap.data() || {};
  const isOwner = viewerUid === profileOwnerUid;
  let isMutualMatch = false;

  if (!isOwner) {
    const matchSnap = await db.doc(`matches/${makePairId(viewerUid, profileOwnerUid)}`).get();
    isMutualMatch = matchSnap.exists && matchSnap.data()?.status === 'active';
  }

  const methods: ContactMethod[] = ['instagram', 'telegram', 'whatsapp', 'website', 'email', 'mobile'];
  const authorized: Partial<Record<ContactMethod, string>> = {};

  for (const method of methods) {
    const field = info[method];
    if (!field || !field.enabled || !field.value) continue;
    if (isOwner || field.visibility === 'public' || (field.visibility === 'matches' && isMutualMatch)) {
      authorized[method] = field.value;
    }
  }

  return { contacts: authorized, isMutualMatch, isBlocked: false };
});

export const updateContactInformation = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

  const method = request.data?.method as ContactMethod;
  const value = sanitizeContactValue(method, String(request.data?.value || ''));
  const visibility = (request.data?.visibility || 'private') as Visibility;
  const enabled = Boolean(request.data?.enabled ?? true);

  const ref = db.doc(`users/${uid}/private_data/contact_information`);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(
    {
      uid,
      [method]: { value, visibility, enabled, updatedAt: now },
      updatedAt: now,
    },
    { merge: true }
  );
  return { ok: true };
});

export const updateContactPrivacy = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

  const method = request.data?.method as ContactMethod;
  const visibility = request.data?.visibility as Visibility;
  if (!['public', 'matches', 'private'].includes(visibility)) {
    throw new HttpsError('invalid-argument', 'Invalid visibility');
  }
  const ref = db.doc(`users/${uid}/private_data/contact_information`);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(
    {
      [method]: {
        visibility,
        ...(typeof request.data?.enabled === 'boolean' ? { enabled: request.data.enabled } : {}),
        updatedAt: now,
      },
      updatedAt: now,
    },
    { merge: true }
  );
  return { ok: true };
});

export const deleteContactInformation = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const method = request.data?.method as ContactMethod;
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.doc(`users/${uid}/private_data/contact_information`).set(
    {
      [method]: { value: '', visibility: 'private', enabled: false, updatedAt: now },
      updatedAt: now,
    },
    { merge: true }
  );
  return { ok: true };
});

export const updateLocation = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

  const lat = Number(request.data?.lat);
  const lng = Number(request.data?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new HttpsError('invalid-argument', 'Valid coordinates required');
  }
  const approxLat = Number((Math.round(lat / 0.015) * 0.015).toFixed(4));
  const approxLng = Number((Math.round(lng / 0.015) * 0.015).toFixed(4));
  const geohash = geohashForLocation([approxLat, approxLng], 7);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000);

  await db.doc(`user_locations/${uid}`).set({
    uid,
    geohash,
    approxLat,
    approxLng,
    nearbyEnabled: true,
    expiresAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { approxLat, approxLng, geohash };
});

export const searchNearby = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

  const centerLat = Number(request.data?.lat);
  const centerLng = Number(request.data?.lng);
  const radiusKm = Math.max(1, Math.min(50, Number(request.data?.radiusKm || 10)));
  const bounds = geohashQueryBounds([centerLat, centerLng], radiusKm * 1000);
  const now = Date.now();

  const matches: Array<{ uid: string; distanceKm: number }> = [];
  for (const [start, end] of bounds) {
    const snap = await db
      .collection('user_locations')
      .where('nearbyEnabled', '==', true)
      .orderBy('geohash')
      .startAt(start)
      .endAt(end)
      .limit(50)
      .get();
    snap.docs.forEach((d) => {
      const loc = d.data();
      if (loc.uid === uid) return;
      if (loc.expiresAt?.toMillis() <= now) return;
      const km = Math.max(1, Math.round(distanceBetween([centerLat, centerLng], [loc.approxLat, loc.approxLng])));
      if (km <= radiusKm) matches.push({ uid: loc.uid, distanceKm: km });
    });
  }
  return { candidates: matches };
});

export const paymentWebhook = onRequest(
  { secrets: [PAYMENT_PROVIDER_SECRET, PAYMENT_WEBHOOK_SECRET] },
  async (req, res) => {
    const secret = PAYMENT_WEBHOOK_SECRET.value();
    const signature = req.headers['x-nearme-signature'];
    if (!secret || typeof signature !== 'string') {
      res.status(401).send('Unauthorized webhook');
      return;
    }
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (signature !== expected) {
      res.status(401).send('Invalid signature');
      return;
    }
    res.json({ received: true });
  }
);
