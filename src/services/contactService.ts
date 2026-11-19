import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type {
  AuthorizedContacts,
  ContactInformation,
  ContactMethod,
  VisibilityLevel,
} from '../types/nearme';
import {
  buildAuthorizedContacts,
  buildContactGrantsPayload,
  CONTACT_METHODS,
  createDefaultContactInformation,
  makePairId,
  sanitizeAndValidateContact,
} from '../utils/validation';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function getOwnContactInformation(uid: string): Promise<ContactInformation> {
  const path = `users/${uid}/private_data/contact_information`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private_data', 'contact_information'));
    if (snap.exists()) {
      return snap.data() as ContactInformation;
    }
    return createDefaultContactInformation(uid, new Date());
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

async function saveAndSyncGrants(uid: string, nextInfo: ContactInformation): Promise<void> {
  const { publicGrant, matchesGrant } = buildContactGrantsPayload(nextInfo);
  const now = serverTimestamp();

  const updatedInfo: ContactInformation = {
    ...nextInfo,
    uid,
    updatedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'private_data', 'contact_information'), updatedInfo);
  batch.set(doc(db, 'profiles', uid, 'contact_grants', 'public'), {
    uid,
    scope: 'public',
    ...publicGrant,
    updatedAt: now,
  });
  batch.set(doc(db, 'profiles', uid, 'contact_grants', 'matches'), {
    uid,
    scope: 'matches',
    ...matchesGrant,
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/private_data/contact_information`);
  }
}

export async function updateContactInformation(
  uid: string,
  method: ContactMethod,
  rawValue: string,
  visibility?: VisibilityLevel,
  enabled?: boolean
): Promise<ContactInformation> {
  const validation = sanitizeAndValidateContact(method, rawValue);
  if (!validation.valid) {
    throw new Error(validation.errorKey || 'errors.generic');
  }

  const current = await getOwnContactInformation(uid);
  const now = serverTimestamp();
  const nextInfo: ContactInformation = {
    ...current,
    [method]: {
      value: validation.normalized,
      visibility: visibility ?? current[method]?.visibility ?? 'private',
      enabled: enabled ?? true,
      updatedAt: now,
    },
    updatedAt: now,
  };

  await saveAndSyncGrants(uid, nextInfo);
  return getOwnContactInformation(uid);
}

export async function updateContactPrivacy(
  uid: string,
  method: ContactMethod,
  visibility: VisibilityLevel,
  enabled?: boolean
): Promise<ContactInformation> {
  const current = await getOwnContactInformation(uid);
  const now = serverTimestamp();
  const prevField = current[method];

  const nextInfo: ContactInformation = {
    ...current,
    [method]: {
      value: prevField?.value || '',
      visibility,
      enabled: enabled ?? prevField?.enabled ?? false,
      updatedAt: now,
    },
    updatedAt: now,
  };

  await saveAndSyncGrants(uid, nextInfo);
  return getOwnContactInformation(uid);
}

export async function deleteContactInformation(
  uid: string,
  method: ContactMethod
): Promise<ContactInformation> {
  const current = await getOwnContactInformation(uid);
  const now = serverTimestamp();

  const nextInfo: ContactInformation = {
    ...current,
    [method]: {
      value: '',
      visibility: 'private',
      enabled: false,
      updatedAt: now,
    },
    updatedAt: now,
  };

  await saveAndSyncGrants(uid, nextInfo);
  return getOwnContactInformation(uid);
}

/**
 * Authorized Contact Retrieval:
 * 1. Verifies authenticated viewer
 * 2. Owner reads private_data/contact_information via buildAuthorizedContacts
 * 3. Non-owner checks block status in both directions
 * 4. Checks active mutual match status
 * 5. Reads ONLY authorized projection documents (contact_grants/matches or contact_grants/public)
 */
export async function getAuthorizedProfileContacts(
  profileOwnerUid: string,
  viewerUid: string | null
): Promise<{
  contacts: AuthorizedContacts;
  isMutualMatch: boolean;
  isBlocked: boolean;
}> {
  if (!viewerUid) {
    return { contacts: {}, isMutualMatch: false, isBlocked: false };
  }

  if (viewerUid === profileOwnerUid) {
    const info = await getOwnContactInformation(profileOwnerUid);
    return {
      contacts: buildAuthorizedContacts(info, {
        viewerUid,
        ownerUid: profileOwnerUid,
        isMutualMatch: false,
        isBlocked: false,
      }),
      isMutualMatch: false,
      isBlocked: false,
    };
  }

  try {
    const [blockA, blockB] = await Promise.all([
      getDoc(doc(db, 'blocked_users', `${viewerUid}_${profileOwnerUid}`)),
      getDoc(doc(db, 'blocked_users', `${profileOwnerUid}_${viewerUid}`)),
    ]);

    if (blockA.exists() || blockB.exists()) {
      return { contacts: {}, isMutualMatch: false, isBlocked: true };
    }

    const pairId = makePairId(viewerUid, profileOwnerUid);
    const matchSnap = await getDoc(doc(db, 'matches', pairId));
    const isMutualMatch = matchSnap.exists() && matchSnap.data()?.status === 'active';

    const grantDocName = isMutualMatch ? 'matches' : 'public';
    const grantSnap = await getDoc(
      doc(db, 'profiles', profileOwnerUid, 'contact_grants', grantDocName)
    );

    if (!grantSnap.exists()) {
      return { contacts: {}, isMutualMatch, isBlocked: false };
    }

    const data = grantSnap.data();
    const contacts: AuthorizedContacts = {};
    for (const method of CONTACT_METHODS) {
      const val = data[method];
      if (typeof val === 'string' && val.length > 0) {
        contacts[method] = val;
      }
    }

    return { contacts, isMutualMatch, isBlocked: false };
  } catch (err) {
    // Permission denied on match grant simply resolves cleanly to empty authorized contacts
    return { contacts: {}, isMutualMatch: false, isBlocked: false };
  }
}
