import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildAuthorizedContacts,
  buildContactGrantsPayload,
  calculateAge,
  calculateProfileCompletion,
  createDefaultContactInformation,
  isAdult18Plus,
  sanitizeAndValidateContact,
} from './validation';
import {
  computeApproxDistanceKm,
  deterministicRadarPosition,
  getNextRadiusSuggestions,
  isLocationExpired,
  quantizeCoordinates,
} from './geo';
import { computeCompatibility } from './matchmaking';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  isRTL,
  toJalali,
} from './localization';
import {
  verifyNearMeWebhookSignature,
  verifyStripeWebhookSignature,
  verifyWebhookRequest,
} from './payments';
import { extractFirebaseAuthErrorDetails, formatGoogleAuthError } from './authErrors';
import type { UserProfile } from '../types/nearme';

test('age validation enforces 18+ strictly', () => {
  const ref = new Date('2026-11-19T00:00:00Z');
  assert.equal(calculateAge('2008-11-19', ref), 18);
  assert.equal(isAdult18Plus('2008-11-19', ref), true);
  assert.equal(calculateAge('2008-11-20', ref), 17);
  assert.equal(isAdult18Plus('2008-11-20', ref), false);
  assert.equal(isAdult18Plus('invalid-date', ref), false);
});

test('contact sanitizer validates all 6 methods and blocks unsafe schemes', () => {
  assert.equal(sanitizeAndValidateContact('instagram', 'javascript:alert(1)').valid, false);
  assert.equal(sanitizeAndValidateContact('website', 'data:text/html,<script>').valid, false);
  assert.equal(sanitizeAndValidateContact('website', 'http://localhost:3000').valid, false);

  const ig = sanitizeAndValidateContact('instagram', '@nearme_official');
  assert.equal(ig.valid, true);
  assert.equal(ig.normalized, '@nearme_official');
  assert.equal(ig.externalUrl, 'https://instagram.com/nearme_official');

  const tg = sanitizeAndValidateContact('telegram', '@nearme_chat');
  assert.equal(tg.valid, true);
  assert.equal(tg.normalized, 'https://t.me/nearme_chat');

  const wa = sanitizeAndValidateContact('whatsapp', '+98 912 345 6789');
  assert.equal(wa.valid, true);
  assert.equal(wa.normalized, '+989123456789');
  assert.equal(wa.externalUrl, 'https://wa.me/989123456789');

  const web = sanitizeAndValidateContact('website', 'https://example.com');
  assert.equal(web.valid, true);

  const email = sanitizeAndValidateContact('email', 'User@Example.COM');
  assert.equal(email.valid, true);
  assert.equal(email.normalized, 'user@example.com');

  const mobile = sanitizeAndValidateContact('mobile', '+44 7700 900077');
  assert.equal(mobile.valid, true);
  assert.equal(mobile.normalized, '+447700900077');
});

test('default contact privacy is private and access control enforces owner/match/public/block', () => {
  const info = createDefaultContactInformation('owner1', 1);
  assert.equal(info.email.visibility, 'private');
  assert.equal(info.mobile.visibility, 'private');
  assert.equal(info.instagram.visibility, 'private');

  info.website = { value: 'https://example.com', visibility: 'public', enabled: true, updatedAt: 1 };
  info.telegram = { value: 'https://t.me/alice', visibility: 'matches', enabled: true, updatedAt: 1 };
  info.email = { value: 'alice@example.com', visibility: 'private', enabled: true, updatedAt: 1 };
  info.mobile = { value: '+989120001122', visibility: 'private', enabled: true, updatedAt: 1 };

  // Public stranger sees ONLY public website
  const strangerView = buildAuthorizedContacts(info, {
    viewerUid: 'stranger',
    ownerUid: 'owner1',
    isMutualMatch: false,
    isBlocked: false,
  });
  assert.deepEqual(strangerView, { website: 'https://example.com' });

  // Mutual match sees public + matches, NEVER private email/mobile
  const matchView = buildAuthorizedContacts(info, {
    viewerUid: 'matchUser',
    ownerUid: 'owner1',
    isMutualMatch: true,
    isBlocked: false,
  });
  assert.deepEqual(matchView, {
    website: 'https://example.com',
    telegram: 'https://t.me/alice',
  });

  // Revoking match immediately revokes telegram
  const unmatchView = buildAuthorizedContacts(info, {
    viewerUid: 'matchUser',
    ownerUid: 'owner1',
    isMutualMatch: false,
    isBlocked: false,
  });
  assert.deepEqual(unmatchView, { website: 'https://example.com' });

  // Blocked user sees nothing even if matched
  const blockedView = buildAuthorizedContacts(info, {
    viewerUid: 'matchUser',
    ownerUid: 'owner1',
    isMutualMatch: true,
    isBlocked: true,
  });
  assert.deepEqual(blockedView, {});

  // Grants payload never includes private fields
  const grants = buildContactGrantsPayload(info);
  assert.deepEqual(grants.publicGrant, { website: 'https://example.com/' });
  assert.deepEqual(grants.matchesGrant, { website: 'https://example.com/', telegram: 'https://t.me/alice' });
});

test('geo quantization prevents exact coordinate storage and radar obscures bearing', () => {
  const q = quantizeCoordinates(35.6892123, 51.3890123);
  assert.notEqual(q.approxLat, 35.6892123);
  assert.ok(q.geohash.length >= 6);

  const dist = computeApproxDistanceKm(35.6892, 51.389, 35.72, 51.42);
  assert.equal(typeof dist, 'number');
  assert.ok(dist >= 1);

  assert.equal(isLocationExpired(1000, 2000), true);
  assert.equal(isLocationExpired(5000, 2000), false);

  const pos1 = deterministicRadarPosition('user_abc', 5, 20);
  const pos2 = deterministicRadarPosition('user_abc', 5, 20);
  assert.deepEqual(pos1, pos2);
  assert.deepEqual(getNextRadiusSuggestions(5), [10, 20]);
});

test('matchmaking compatibility computes transparent reasons', () => {
  const viewer: UserProfile = {
    uid: 'u1',
    displayName: 'Sara',
    birthDate: '1997-04-10',
    age: 29,
    gender: 'woman',
    preferredGender: 'everyone',
    country: 'Iran',
    city: 'Tehran',
    biography: 'Love art and travel',
    interests: ['travel', 'music', 'photography'],
    hobbies: ['cycling'],
    languages: ['Persian', 'English'],
    relationshipGoals: 'serious',
    verificationStatus: 'verified',
    profileVisibility: 'public',
    accountStatus: 'active',
    createdAt: 1,
    updatedAt: 1,
  };

  const candidate: UserProfile = {
    ...viewer,
    uid: 'u2',
    displayName: 'Arman',
    gender: 'man',
    interests: ['travel', 'music', 'cinema'],
    languages: ['English', 'Turkish'],
  };

  const result = computeCompatibility(viewer, null, candidate, 4);
  assert.ok(result.score >= 50 && result.score <= 99);
  assert.ok(result.reasons.some((r) => r.key === 'matchmaking.reasons.sharedInterests'));
  assert.ok(calculateProfileCompletion(viewer, 1) >= 90);
});

test('localization handles RTL/LTR, Jalali calendar, and 6-language formatting', () => {
  assert.equal(isRTL('fa'), true);
  assert.equal(isRTL('ar'), true);
  assert.equal(isRTL('en'), false);
  assert.equal(isRTL('tr'), false);
  assert.equal(isRTL('zh-CN'), false);
  assert.equal(isRTL('zh-TW'), false);

  const jalali = toJalali(new Date(2026, 2, 21)); // March 21, 2026 -> 1 Farvardin 1405
  assert.deepEqual(jalali, { year: 1405, month: 1, day: 1 });

  const faDate = formatLocalizedDate(new Date(2026, 2, 21), 'fa');
  assert.ok(faDate.includes('فروردین'));

  const usd = formatLocalizedCurrency(19.99, 'en');
  assert.ok(usd.includes('19.99'));
});

test('payment webhook verification validates custom HMAC and Stripe timestamped signatures', () => {
  const secret = 'test_webhook_secret_1234567890';
  const payload = Buffer.from(JSON.stringify({ event: 'checkout.completed', uid: 'u1' }));

  const customSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal(verifyNearMeWebhookSignature(payload, customSig, secret), true);
  assert.equal(verifyNearMeWebhookSignature(payload, 'bad_sig', secret), false);

  const ts = 1795000000;
  const stripeSig = crypto.createHmac('sha256', secret).update(`${ts}.${payload.toString('utf8')}`).digest('hex');
  const stripeHeader = `t=${ts},v1=${stripeSig}`;
  assert.equal(verifyStripeWebhookSignature(payload, stripeHeader, secret, ts + 30), true);
  assert.equal(verifyStripeWebhookSignature(payload, stripeHeader, secret, ts + 999), false);

  assert.deepEqual(
    verifyWebhookRequest(payload, { stripeSignature: stripeHeader }, secret, ts + 10),
    { valid: true, provider: 'stripe' }
  );
  assert.deepEqual(
    verifyWebhookRequest(payload, { nearmeSignature: customSig }, secret),
    { valid: true, provider: 'custom' }
  );
  assert.equal(verifyWebhookRequest(payload, {}, secret).valid, false);
});

test('Firebase Auth error parser captures popup-closed-by-user, unauthorized-domain, and Firestore rules denials', () => {
  const popupClosedErr = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
    code: 'auth/popup-closed-by-user',
    customData: { appName: '[DEFAULT]' },
  });
  const popupDetails = extractFirebaseAuthErrorDetails(popupClosedErr);
  assert.equal(popupDetails.code, 'auth/popup-closed-by-user');
  assert.equal(popupDetails.isPopupClosedByUser, true);
  assert.equal(popupDetails.isUnauthorizedDomain, false);
  const formattedPopup = formatGoogleAuthError(popupClosedErr, 'fa', 'fallback');
  assert.equal(formattedPopup.code, 'auth/popup-closed-by-user');
  assert.equal(formattedPopup.isIframePopupIssue, true);

  const domainErr = Object.assign(new Error('Firebase: Error (auth/unauthorized-domain).'), {
    code: 'auth/unauthorized-domain',
  });
  const domainDetails = extractFirebaseAuthErrorDetails(domainErr);
  assert.equal(domainDetails.code, 'auth/unauthorized-domain');
  assert.equal(domainDetails.isUnauthorizedDomain, true);
  const formattedDomain = formatGoogleAuthError(domainErr, 'en', 'fallback', 'example.run.app');
  assert.equal(formattedDomain.code, 'auth/unauthorized-domain');
  assert.ok(formattedDomain.message.includes('example.run.app'));

  const rulesErr = new Error('Missing or insufficient permissions.');
  const formattedRules = formatGoogleAuthError(rulesErr, 'fa', 'fallback');
  assert.equal(formattedRules.isFirestoreRulesIssue, true);
});
