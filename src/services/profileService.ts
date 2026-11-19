import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import type {
  AccountSettings,
  LanguageCode,
  ProfilePhoto,
  UserAccount,
  UserPreferences,
  UserProfile,
  VisibilityLevel,
} from '../types/nearme';
import { calculateAge, createDefaultContactInformation, isAdult18Plus, makePairId, sanitizeText } from '../utils/validation';
import { db, handleFirestoreError, OperationType, storage } from './firebase';

const MAX_PHOTOS = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserAccount) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `profiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'profiles', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getUserPreferences(uid: string): Promise<UserPreferences | null> {
  const path = `preferences/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'preferences', uid));
    return snap.exists() ? (snap.data() as UserPreferences) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getAccountSettings(uid: string): Promise<AccountSettings | null> {
  const path = `users/${uid}/private_data/account_settings`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private_data', 'account_settings'));
    return snap.exists() ? (snap.data() as AccountSettings) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function initializeUserRecords(params: {
  uid: string;
  displayName: string;
  birthDate: string;
  emailVerified: boolean;
  language: LanguageCode;
}): Promise<void> {
  if (!isAdult18Plus(params.birthDate)) {
    throw new Error('errors.under18');
  }
  const age = calculateAge(params.birthDate);
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.set(doc(db, 'users', params.uid), {
    uid: params.uid,
    role: 'user',
    accountStatus: 'active',
    membershipTier: 'free',
    emailVerified: params.emailVerified,
    phoneVerified: false,
    selfieVerificationStatus: 'none',
    ageConfirmed18Plus: true,
    birthDate: params.birthDate,
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(db, 'profiles', params.uid), {
    uid: params.uid,
    displayName: sanitizeText(params.displayName, 60) || 'Member',
    birthDate: params.birthDate,
    age,
    gender: 'other',
    preferredGender: 'everyone',
    country: 'International',
    city: 'Global',
    biography: '',
    occupation: '',
    interests: [],
    hobbies: [],
    languages: ['English'],
    relationshipGoals: 'undecided',
    mainPhotoUrl: '',
    mainPhotoVisibility: 'public',
    verificationStatus: 'unverified',
    profileVisibility: 'public',
    accountStatus: 'active',
    isOnline: true,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(db, 'preferences', params.uid), {
    uid: params.uid,
    minimumAge: 18,
    maximumAge: 45,
    preferredGender: 'everyone',
    preferredCountry: '',
    preferredCity: '',
    preferredLanguages: [],
    preferredInterests: [],
    relationshipGoals: '',
    searchRadiusKm: 10,
    nearbyEnabled: false,
    updatedAt: now,
  });

  batch.set(
    doc(db, 'users', params.uid, 'private_data', 'contact_information'),
    createDefaultContactInformation(params.uid, now)
  );

  batch.set(doc(db, 'users', params.uid, 'private_data', 'account_settings'), {
    uid: params.uid,
    preferredLanguage: params.language,
    theme: 'dark',
    notifications: {
      matches: true,
      messages: true,
      likes: true,
      verification: true,
      subscriptions: true,
      security: true,
      browserPush: false,
    },
    consentGdpr: true,
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const path = `profiles/${uid}`;
  const clean: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  };

  if (updates.displayName !== undefined) clean.displayName = sanitizeText(updates.displayName, 60);
  if (updates.birthDate !== undefined) {
    if (!isAdult18Plus(updates.birthDate)) throw new Error('errors.under18');
    clean.birthDate = updates.birthDate;
    clean.age = calculateAge(updates.birthDate);
  }
  if (updates.gender !== undefined) clean.gender = updates.gender;
  if (updates.preferredGender !== undefined) clean.preferredGender = updates.preferredGender;
  if (updates.country !== undefined) clean.country = sanitizeText(updates.country, 80);
  if (updates.city !== undefined) clean.city = sanitizeText(updates.city, 80);
  if (updates.biography !== undefined) clean.biography = sanitizeText(updates.biography, 600);
  if (updates.occupation !== undefined) clean.occupation = sanitizeText(updates.occupation, 80);
  if (updates.interests !== undefined) clean.interests = updates.interests.slice(0, 12);
  if (updates.hobbies !== undefined) clean.hobbies = updates.hobbies.slice(0, 12);
  if (updates.languages !== undefined) clean.languages = updates.languages.slice(0, 10);
  if (updates.relationshipGoals !== undefined) clean.relationshipGoals = updates.relationshipGoals;
  if (updates.profileVisibility !== undefined) clean.profileVisibility = updates.profileVisibility;
  if (updates.isOnline !== undefined) clean.isOnline = updates.isOnline;

  try {
    await updateDoc(doc(db, 'profiles', uid), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserPreferences(
  uid: string,
  updates: Partial<UserPreferences>
): Promise<void> {
  const path = `preferences/${uid}`;
  const payload = {
    ...updates,
    uid,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'preferences', uid), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateAccountSettings(
  uid: string,
  updates: Partial<AccountSettings>
): Promise<void> {
  const path = `users/${uid}/private_data/account_settings`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'private_data', 'account_settings'),
      { ...updates, uid, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function completeOnboarding(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function requestSelfieVerification(uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    selfieVerificationStatus: 'pending',
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

// ==================== PHOTO GALLERY MANAGEMENT ====================

async function compressImage(
  file: File,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Image compression failed'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('errors.invalidImageType'));
    };
    img.src = url;
  });
}

export async function getUserPhotos(
  ownerUid: string,
  viewerUid: string
): Promise<ProfilePhoto[]> {
  const path = `profiles/${ownerUid}/photos`;
  try {
    if (ownerUid === viewerUid) {
      const snap = await getDocs(query(collection(db, 'profiles', ownerUid, 'photos'), orderBy('sortOrder', 'asc')));
      return snap.docs.map((d) => d.data() as ProfilePhoto);
    }

    // Non-owners read public photos via list query (allowed by rules)
    const publicSnap = await getDocs(
      query(collection(db, 'profiles', ownerUid, 'photos'), orderBy('sortOrder', 'asc'))
    );
    const photos = publicSnap.docs
      .map((d) => d.data() as ProfilePhoto)
      .filter((p) => p.visibility === 'public' && p.moderationStatus !== 'rejected');

    // Check if matched to load match-only photos via gated manifest
    const pairId = makePairId(ownerUid, viewerUid);
    const matchSnap = await getDoc(doc(db, 'matches', pairId));
    if (matchSnap.exists() && matchSnap.data()?.status === 'active') {
      const manifestSnap = await getDoc(doc(db, 'profiles', ownerUid, 'photo_manifest', 'matches'));
      if (manifestSnap.exists()) {
        const ids: string[] = manifestSnap.data()?.photoIds || [];
        for (const pid of ids) {
          if (!photos.some((existing) => existing.photoId === pid)) {
            const pSnap = await getDoc(doc(db, 'profiles', ownerUid, 'photos', pid));
            if (pSnap.exists()) {
              const photo = pSnap.data() as ProfilePhoto;
              if (photo.moderationStatus !== 'rejected') {
                photos.push(photo);
              }
            }
          }
        }
      }
    }

    return photos.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

async function syncMatchPhotoManifest(uid: string, photos: ProfilePhoto[]): Promise<void> {
  const matchPhotoIds = photos
    .filter((p) => p.visibility === 'matches')
    .map((p) => p.photoId)
    .slice(0, MAX_PHOTOS);
  await setDoc(doc(db, 'profiles', uid, 'photo_manifest', 'matches'), {
    uid,
    photoIds: matchPhotoIds,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadProfilePhoto(params: {
  uid: string;
  file: File;
  visibility: VisibilityLevel;
  cropX?: number;
  cropY?: number;
  zoom?: number;
  onProgress?: (pct: number) => void;
}): Promise<ProfilePhoto> {
  if (!ALLOWED_MIME_TYPES.includes(params.file.type)) {
    throw new Error('errors.invalidImageType');
  }
  if (params.file.size > MAX_IMAGE_BYTES) {
    throw new Error('errors.imageTooLarge');
  }

  const existingPhotos = await getUserPhotos(params.uid, params.uid);
  if (existingPhotos.length >= MAX_PHOTOS) {
    throw new Error('photos.maxReached');
  }

  const photoId = `ph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const compressed = await compressImage(params.file, 1440, 0.84);
  const thumb = await compressImage(params.file, 360, 0.78);

  const storagePath = `users/${params.uid}/photos/${params.visibility}/${photoId}.webp`;
  const thumbnailPath = `users/${params.uid}/photos/${params.visibility}/${photoId}_thumb.webp`;

  const mainRef = ref(storage, storagePath);
  const thumbRef = ref(storage, thumbnailPath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(mainRef, compressed, { contentType: 'image/webp' });
    task.on(
      'state_changed',
      (snap) => {
        if (params.onProgress) {
          params.onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      () => resolve()
    );
  });

  await uploadBytesResumable(thumbRef, thumb, { contentType: 'image/webp' });
  const url = await getDownloadURL(mainRef);
  const thumbnailUrl = await getDownloadURL(thumbRef);

  const isMain = existingPhotos.length === 0;
  const sortOrder = existingPhotos.length;

  const photoDoc: ProfilePhoto = {
    photoId,
    uid: params.uid,
    storagePath,
    thumbnailPath,
    url,
    thumbnailUrl,
    isMain,
    sortOrder,
    visibility: params.visibility,
    moderationStatus: 'pending',
    cropX: params.cropX ?? 50,
    cropY: params.cropY ?? 50,
    zoom: params.zoom ?? 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'profiles', params.uid, 'photos', photoId), photoDoc);
    if (isMain) {
      await updateDoc(doc(db, 'profiles', params.uid), {
        mainPhotoUrl: params.visibility === 'private' ? '' : url,
        mainPhotoVisibility: params.visibility,
        updatedAt: serverTimestamp(),
      });
    }
    await syncMatchPhotoManifest(params.uid, [...existingPhotos, photoDoc]);
    return photoDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `profiles/${params.uid}/photos/${photoId}`);
  }
}

export async function updatePhotoMetadata(
  uid: string,
  photo: ProfilePhoto,
  updates: Partial<Pick<ProfilePhoto, 'visibility' | 'cropX' | 'cropY' | 'zoom' | 'sortOrder' | 'isMain'>>
): Promise<void> {
  const path = `profiles/${uid}/photos/${photo.photoId}`;
  try {
    await updateDoc(doc(db, 'profiles', uid, 'photos', photo.photoId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    const allPhotos = await getUserPhotos(uid, uid);
    await syncMatchPhotoManifest(uid, allPhotos);
    if (photo.isMain || updates.isMain) {
      const vis = updates.visibility ?? photo.visibility;
      await updateDoc(doc(db, 'profiles', uid), {
        mainPhotoUrl: vis === 'private' ? '' : photo.url,
        mainPhotoVisibility: vis,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function setMainProfilePhoto(uid: string, photoId: string): Promise<void> {
  const photos = await getUserPhotos(uid, uid);
  const target = photos.find((p) => p.photoId === photoId);
  if (!target) return;

  const batch = writeBatch(db);
  for (const p of photos) {
    batch.update(doc(db, 'profiles', uid, 'photos', p.photoId), {
      isMain: p.photoId === photoId,
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, 'profiles', uid), {
    mainPhotoUrl: target.visibility === 'private' ? '' : target.url,
    mainPhotoVisibility: target.visibility,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${uid}/photos`);
  }
}

export async function reorderProfilePhotos(uid: string, orderedPhotoIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedPhotoIds.forEach((pid, index) => {
    batch.update(doc(db, 'profiles', uid, 'photos', pid), {
      sortOrder: index,
      updatedAt: serverTimestamp(),
    });
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${uid}/photos`);
  }
}

export async function deleteProfilePhoto(uid: string, photo: ProfilePhoto): Promise<void> {
  const path = `profiles/${uid}/photos/${photo.photoId}`;
  try {
    if (photo.storagePath) {
      await deleteObject(ref(storage, photo.storagePath)).catch(() => {});
    }
    if (photo.thumbnailPath) {
      await deleteObject(ref(storage, photo.thumbnailPath)).catch(() => {});
    }
    await deleteDoc(doc(db, 'profiles', uid, 'photos', photo.photoId));

    const remaining = await getUserPhotos(uid, uid);
    await syncMatchPhotoManifest(uid, remaining);
    if (photo.isMain) {
      const nextMain = remaining[0];
      if (nextMain) {
        await setMainProfilePhoto(uid, nextMain.photoId);
      } else {
        await updateDoc(doc(db, 'profiles', uid), {
          mainPhotoUrl: '',
          mainPhotoVisibility: 'public',
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deactivateUserAccount(uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    accountStatus: 'deleted',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'profiles', uid), {
    accountStatus: 'deleted',
    profileVisibility: 'hidden',
    isOnline: false,
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'user_locations', uid));
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
}
