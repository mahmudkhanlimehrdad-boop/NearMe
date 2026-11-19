import {
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  Timestamp,
  where,
} from 'firebase/firestore';
import type {
  NearbyCandidate,
  PreferredGender,
  UserLocation,
  UserPreferences,
  UserProfile,
} from '../types/nearme';
import {
  computeApproxDistanceKm,
  getGeohashBoundsForRadius,
  LOCATION_TTL_MS,
  quantizeCoordinates,
} from '../utils/geo';
import { computeCompatibility } from '../utils/matchmaking';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function updateNearbyLocation(
  uid: string,
  rawLat: number,
  rawLng: number,
  radiusKm: number
): Promise<{ approxLat: number; approxLng: number; geohash: string }> {
  const { approxLat, approxLng, geohash } = quantizeCoordinates(rawLat, rawLng);
  const expiresAt = Timestamp.fromMillis(Date.now() + LOCATION_TTL_MS);

  try {
    await setDoc(doc(db, 'user_locations', uid), {
      uid,
      geohash,
      approxLat,
      approxLng,
      nearbyEnabled: true,
      expiresAt,
      updatedAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, 'preferences', uid),
      { uid, nearbyEnabled: true, searchRadiusKm: radiusKm, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { approxLat, approxLng, geohash };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `user_locations/${uid}`);
  }
}

export async function disableNearbyLocation(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'user_locations', uid)).catch(() => {});
    await setDoc(
      doc(db, 'preferences', uid),
      { uid, nearbyEnabled: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `user_locations/${uid}`);
  }
}

async function getBlockedUidSet(uid: string): Promise<Set<string>> {
  const blocked = new Set<string>();
  try {
    const snap = await getDocs(
      query(collection(db, 'blocked_users'), where('blockerUid', '==', uid))
    );
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data?.blockedUid) blocked.add(data.blockedUid);
    });
  } catch {
    // Ignore if none
  }
  return blocked;
}

export async function searchNearbyProfiles(params: {
  viewerProfile: UserProfile;
  viewerPrefs: UserPreferences | null;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}): Promise<NearbyCandidate[]> {
  const { viewerProfile, viewerPrefs, centerLat, centerLng, radiusKm } = params;
  const bounds = getGeohashBoundsForRadius(centerLat, centerLng, radiusKm);
  const blockedSet = await getBlockedUidSet(viewerProfile.uid);
  const nowMs = Date.now();

  const candidateLocations = new Map<string, UserLocation>();
  try {
    const snaps = await Promise.all(
      bounds.map(([start, end]) =>
        getDocs(
          query(
            collection(db, 'user_locations'),
            where('nearbyEnabled', '==', true),
            orderBy('geohash'),
            startAt(start),
            endAt(end),
            limit(50)
          )
        )
      )
    );

    for (const snap of snaps) {
      for (const docSnap of snap.docs) {
        const loc = docSnap.data() as UserLocation;
        if (loc.uid === viewerProfile.uid || blockedSet.has(loc.uid)) continue;
        const expMs =
          loc.expiresAt && typeof (loc.expiresAt as Timestamp).toMillis === 'function'
            ? (loc.expiresAt as Timestamp).toMillis()
            : 0;
        if (expMs <= nowMs) continue;
        candidateLocations.set(loc.uid, loc);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'user_locations');
  }

  const results: NearbyCandidate[] = [];
  await Promise.all(
    Array.from(candidateLocations.values()).map(async (loc) => {
      const distanceKm = computeApproxDistanceKm(
        centerLat,
        centerLng,
        loc.approxLat,
        loc.approxLng
      );
      if (distanceKm > radiusKm) return;

      try {
        const pSnap = await getDoc(doc(db, 'profiles', loc.uid));
        if (!pSnap.exists()) return;
        const profile = pSnap.data() as UserProfile;
        if (profile.accountStatus !== 'active' || profile.profileVisibility !== 'public') return;

        if (viewerPrefs) {
          if (profile.age < viewerPrefs.minimumAge || profile.age > viewerPrefs.maximumAge) return;
          if (
            viewerPrefs.preferredGender !== 'everyone' &&
            profile.gender !== viewerPrefs.preferredGender
          ) {
            return;
          }
        }

        const compatibility = computeCompatibility(viewerProfile, viewerPrefs, profile, distanceKm);
        results.push({ profile, distanceKm, compatibility });
      } catch {
        // Blocked or inaccessible profile skipped gracefully
      }
    })
  );

  return results.sort((a, b) => a.distanceKm - b.distanceKm || b.compatibility.score - a.compatibility.score);
}

export interface GlobalDiscoverFilters {
  gender: PreferredGender;
  minAge: number;
  maxAge: number;
  country: string;
  city: string;
  language: string;
  interest: string;
  relationshipGoal: string;
  onlineOnly: boolean;
  verifiedOnly: boolean;
  sortBy: 'relevance' | 'distance' | 'active';
}

export async function searchGlobalProfiles(
  viewerProfile: UserProfile,
  viewerPrefs: UserPreferences | null,
  filters: GlobalDiscoverFilters
): Promise<NearbyCandidate[]> {
  const blockedSet = await getBlockedUidSet(viewerProfile.uid);
  const path = 'profiles';

  try {
    const snap = await getDocs(
      query(
        collection(db, 'profiles'),
        where('accountStatus', '==', 'active'),
        where('profileVisibility', '==', 'public'),
        orderBy('lastActiveAt', 'desc'),
        limit(80)
      )
    );

    const results: NearbyCandidate[] = [];
    for (const d of snap.docs) {
      const profile = d.data() as UserProfile;
      if (profile.uid === viewerProfile.uid || blockedSet.has(profile.uid)) continue;
      if (profile.age < filters.minAge || profile.age > filters.maxAge) continue;
      if (filters.gender !== 'everyone' && profile.gender !== filters.gender) continue;
      if (
        filters.country &&
        !profile.country.toLowerCase().includes(filters.country.toLowerCase())
      ) {
        continue;
      }
      if (filters.city && !profile.city.toLowerCase().includes(filters.city.toLowerCase())) {
        continue;
      }
      if (
        filters.language &&
        !(profile.languages || []).some((l) => l.toLowerCase() === filters.language.toLowerCase())
      ) {
        continue;
      }
      if (
        filters.interest &&
        !(profile.interests || []).includes(filters.interest) &&
        !(profile.hobbies || []).includes(filters.interest)
      ) {
        continue;
      }
      if (filters.relationshipGoal && profile.relationshipGoals !== filters.relationshipGoal) {
        continue;
      }
      if (filters.onlineOnly && !profile.isOnline) continue;
      if (filters.verifiedOnly && profile.verificationStatus !== 'verified') continue;

      const compatibility = computeCompatibility(viewerProfile, viewerPrefs, profile);
      results.push({ profile, distanceKm: 0, compatibility });
    }

    if (filters.sortBy === 'relevance') {
      results.sort((a, b) => b.compatibility.score - a.compatibility.score);
    }
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
