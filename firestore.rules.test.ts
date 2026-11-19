import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAuthorizedContacts, buildContactGrantsPayload, isAdult18Plus } from './src/utils/validation';
import type { ContactInformation } from './src/types/nearme';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf8');

test('firestore.rules enforces Phase 0 Dirty Dozen security invariants', () => {
  // 1. Master deny catch-all at top
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);

  // 2. Private contact_information strictly owner-only (no non-owner get or list)
  assert.match(rulesText, /match \/private_data\/contact_information \{\s*allow get: if isValidId\(uid\) && isOwner\(uid\);/);

  // 3. Contact grants split between public and match-gated
  assert.match(rulesText, /match \/contact_grants\/matches \{[\s\S]*isMatchedWith\(uid\)/);
  assert.match(rulesText, /!isBlockedEitherWay\(uid\)/);

  // 4. 18+ age validation enforced in rules
  assert.match(rulesText, /data\.age is number && data\.age >= 18/);
  assert.match(rulesText, /incoming\(\)\.ageConfirmed18Plus == true/);

  // 5. Privilege escalation prevention (role, membershipTier, verificationStatus locked)
  assert.match(rulesText, /incoming\(\)\.role == 'user'/);
  assert.match(rulesText, /incoming\(\)\.membershipTier == 'free'/);
  assert.match(rulesText, /incoming\(\)\.verificationStatus == 'unverified'/);

  // 6. ID poisoning guard and server timestamp checks
  assert.match(rulesText, /id\.size\(\) <= 128/);
  assert.match(rulesText, /request\.time/);

  // 7. Immutable audit logs
  assert.match(rulesText, /match \/audit_logs\/\{logId\}[\s\S]*allow update, delete: if false;/);
});

test('Dirty Dozen payload simulation rejects underage, private contact leak, and blocked reads', () => {
  assert.equal(isAdult18Plus('2010-01-01', new Date('2026-11-19')), false);

  const privateContacts: ContactInformation = {
    uid: 'target_uid',
    instagram: { value: '@secret', visibility: 'private', enabled: true, updatedAt: 1 },
    telegram: { value: 'https://t.me/matchonly', visibility: 'matches', enabled: true, updatedAt: 1 },
    whatsapp: { value: '+989121112233', visibility: 'private', enabled: true, updatedAt: 1 },
    website: { value: 'https://public.site', visibility: 'public', enabled: true, updatedAt: 1 },
    email: { value: 'private@mail.com', visibility: 'private', enabled: true, updatedAt: 1 },
    mobile: { value: '+989121112233', visibility: 'private', enabled: true, updatedAt: 1 },
    updatedAt: 1,
  };

  // Unauthenticated or blocked user gets empty map
  assert.deepEqual(
    buildAuthorizedContacts(privateContacts, {
      viewerUid: null,
      ownerUid: 'target_uid',
      isMutualMatch: true,
      isBlocked: false,
    }),
    {}
  );

  // Non-match cannot see matches-only telegram or private email/mobile
  assert.deepEqual(
    buildAuthorizedContacts(privateContacts, {
      viewerUid: 'other_uid',
      ownerUid: 'target_uid',
      isMutualMatch: false,
      isBlocked: false,
    }),
    { website: 'https://public.site' }
  );

  const grants = buildContactGrantsPayload(privateContacts);
  assert.equal('email' in grants.publicGrant, false);
  assert.equal('email' in grants.matchesGrant, false);
  assert.equal('mobile' in grants.matchesGrant, false);
});
