import type { CompatibilityResult, UserPreferences, UserProfile } from '../types/nearme';
import { calculateProfileCompletion } from './validation';

/**
 * Computes a transparent, recommendation-only compatibility score (0-100)
 * using strictly non-sensitive compatibility attributes:
 * mutual preferences, age range, shared interests/hobbies, languages, relationship goals,
 * proximity, activity recency, and profile completeness.
 */
export function computeCompatibility(
  viewer: UserProfile,
  viewerPrefs: UserPreferences | null,
  candidate: UserProfile,
  distanceKm?: number
): CompatibilityResult {
  let score = 20; // Baseline for eligible active adult profiles
  const reasons: Array<{ key: string; items?: string[] }> = [];

  // 1. Mutual gender fit (+15)
  const viewerLikesCandidate =
    !viewerPrefs ||
    viewerPrefs.preferredGender === 'everyone' ||
    viewerPrefs.preferredGender === candidate.gender;
  const candidateLikesViewer =
    candidate.preferredGender === 'everyone' ||
    candidate.preferredGender === viewer.gender;

  if (viewerLikesCandidate && candidateLikesViewer) {
    score += 15;
    reasons.push({ key: 'matchmaking.reasons.mutualPreference' });
  }

  // 2. Age range fit (+10)
  if (viewerPrefs) {
    if (candidate.age >= viewerPrefs.minimumAge && candidate.age <= viewerPrefs.maximumAge) {
      score += 10;
    }
  } else {
    score += 5;
  }

  // 3. Shared interests & hobbies (up to +25)
  const viewerInterestSet = new Set([...(viewer.interests || []), ...(viewer.hobbies || [])]);
  const sharedInterests = [...new Set([...(candidate.interests || []), ...(candidate.hobbies || [])])].filter(
    (item) => viewerInterestSet.has(item)
  );
  if (sharedInterests.length > 0) {
    score += Math.min(25, sharedInterests.length * 7);
    reasons.push({ key: 'matchmaking.reasons.sharedInterests', items: sharedInterests.slice(0, 3) });
  }

  // 4. Shared languages (up to +12)
  const viewerLangs = new Set(viewer.languages || []);
  const sharedLangs = (candidate.languages || []).filter((lang) => viewerLangs.has(lang));
  if (sharedLangs.length > 0) {
    score += Math.min(12, sharedLangs.length * 6);
    reasons.push({ key: 'matchmaking.reasons.sharedLanguages', items: sharedLangs.slice(0, 2) });
  }

  // 5. Relationship goals alignment (+10)
  if (viewer.relationshipGoals && candidate.relationshipGoals === viewer.relationshipGoals) {
    score += 10;
    reasons.push({ key: 'matchmaking.reasons.sameGoals' });
  }

  // 6. Distance fit (up to +8)
  if (typeof distanceKm === 'number') {
    const maxR = viewerPrefs?.searchRadiusKm ?? 20;
    if (distanceKm <= maxR) {
      score += distanceKm <= 5 ? 8 : 5;
      reasons.push({ key: 'matchmaking.reasons.nearby' });
    }
  } else if (viewer.city && candidate.city && viewer.city.toLowerCase() === candidate.city.toLowerCase()) {
    score += 6;
    reasons.push({ key: 'matchmaking.reasons.sameCity' });
  }

  // 7. Profile completeness & activity (up to +5)
  const completeness = calculateProfileCompletion(candidate, candidate.mainPhotoUrl ? 1 : 0);
  if (completeness >= 80) {
    score += 3;
  }
  if (candidate.isOnline) {
    score += 2;
  }

  return {
    score: Math.max(15, Math.min(99, Math.round(score))),
    reasons,
  };
}
