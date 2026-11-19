import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';

export const RADIUS_OPTIONS_KM = [1, 2, 3, 5, 10, 20, 30, 50] as const;
export const EXPANSION_SUGGESTIONS_KM = [2, 3, 5, 10, 20] as const;

// 2-hour default TTL for nearby coordinates so stale positions expire automatically
export const LOCATION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Quantizes exact GPS coordinates onto a ~1.5km grid cell so raw user coordinates
 * are never stored or exposed to other clients (anti-triangulation).
 */
export function quantizeCoordinates(lat: number, lng: number): { approxLat: number; approxLng: number; geohash: string } {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const clampedLng = Math.max(-180, Math.min(180, lng));
  const step = 0.015; // ~1.67km latitude grid
  const approxLat = Number((Math.round(clampedLat / step) * step).toFixed(4));
  const approxLng = Number((Math.round(clampedLng / step) * step).toFixed(4));
  const geohash = geohashForLocation([approxLat, approxLng], 7);
  return { approxLat, approxLng, geohash };
}

export function getGeohashBoundsForRadius(lat: number, lng: number, radiusKm: number): Array<[string, string]> {
  const clampedRadius = Math.max(1, Math.min(50, radiusKm));
  return geohashQueryBounds([lat, lng], clampedRadius * 1000);
}

/**
 * Computes approximate distance in km, rounded to 1 km minimum bucket
 * so exact user coordinates cannot be triangulated.
 */
export function computeApproxDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const km = distanceBetween([lat1, lng1], [lat2, lng2]);
  if (km < 1) return 1;
  return Math.round(km);
}

export function formatApproxDistance(distanceKm: number): string {
  if (distanceKm <= 1) return '< 1 km';
  return `~${Math.round(distanceKm)} km`;
}

export function isLocationExpired(expiresAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs >= expiresAtMs;
}

/**
 * Computes a deterministic pseudo-random angle from a user's UID so the Nearby Radar
 * displays relative proximity rings without ever leaking geographic compass bearing.
 */
export function deterministicRadarPosition(
  uid: string,
  distanceKm: number,
  maxRadiusKm: number
): { xPercent: number; yPercent: number } {
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const angleRad = ((hash >>> 0) % 360) * (Math.PI / 180);
  const ratio = Math.min(0.88, Math.max(0.18, distanceKm / Math.max(1, maxRadiusKm)));
  const xPercent = 50 + Math.cos(angleRad) * (ratio * 42);
  const yPercent = 50 + Math.sin(angleRad) * (ratio * 42);
  return {
    xPercent: Number(xPercent.toFixed(2)),
    yPercent: Number(yPercent.toFixed(2)),
  };
}

export function getNextRadiusSuggestions(currentRadiusKm: number): number[] {
  return EXPANSION_SUGGESTIONS_KM.filter((r) => r > currentRadiusKm);
}
