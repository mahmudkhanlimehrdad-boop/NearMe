# NearMe Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Master Deny Default**: Every unspecified path under `/databases/{database}/documents` is denied (`allow read, write: if false;`).
2. **PII & Contact Isolation**: `users/{uid}/private_data/contact_information` is readable and writable **only** by `uid` (owner). Public `profiles/{uid}` never contains `email`, `mobile`, private social links, or exact GPS coordinates.
3. **Contact Grants Integrity**:
   - `profiles/{uid}/contact_grants/public` is readable by signed-in, non-blocked users.
   - `profiles/{uid}/contact_grants/matches` is readable **only** by the owner or an active mutual match (`matches/{pairId}.status == 'active'`) who is not blocked by/blocking `uid`.
   - Private contacts are never written to either `contact_grants` document.
4. **Photo Visibility**:
   - `private` photos (`visibility == 'private'`) are readable only by owner or admin.
   - `matches` photos (`visibility == 'matches'`) are readable only by owner, admin, or an active mutual match (not blocked).
   - `public` photos (`visibility == 'public'`) are readable by signed-in non-blocked users when `moderationStatus != 'rejected'`.
5. **18+ Age Enforcement**: `profiles/{uid}` and `users/{uid}` require `age >= 18` and `ageConfirmed18Plus == true` on creation and update.
6. **Privilege Escalation Prevention**: Users cannot set `role` to `'admin'`/`'moderator'`, cannot set `membershipTier` to `'vip'`, and cannot set `verificationStatus` to `'verified'` on their own documents.
7. **Match & Messaging Integrity**: A `MatchRecord` requires deterministic `matchId` (`minUid_maxUid`), two distinct UIDs, and `status == 'active'` on creation; only participants (`userA` or `userB`) can read or message inside `conversations/{conversationId}/messages`, and blocked users cannot message.
8. **Immutable Audit Logs**: `audit_logs` are append-only by admins (`allow update, delete: if false;`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Profile Read**: Unauthenticated `get(/profiles/userA)` -> DENIED.
2. **Shadow Field Injection on Profile**: Creating `/profiles/userA` with extra ghost field `isAdmin: true` or `email: "a@b.com"` -> DENIED (`hasOnly` check).
3. **Self-Assigned Admin Role**: Creating `/users/userA` with `role: "admin"` -> DENIED (`role == 'user'` required).
4. **Self-Assigned VIP Tier**: Updating `/users/userA` with `membershipTier: "vip"` -> DENIED (forbidden in user `affectedKeys`).
5. **Self-Assigned Verification Badge**: Updating `/profiles/userA` with `verificationStatus: "verified"` -> DENIED (forbidden in user `affectedKeys`).
6. **Under-18 Registration**: Creating `/profiles/userA` with `age: 17` -> DENIED (`age >= 18` required).
7. **Cross-User Private Contact Read**: `userB` calling `get(/users/userA/private_data/contact_information)` -> DENIED (`isOwner(uid)` required).
8. **Non-Match Contact Grant Read**: `userB` (no active match with `userA`) calling `get(/profiles/userA/contact_grants/matches)` -> DENIED.
9. **Blocked User Photo/Contact Read**: `userB` (blocked by `userA`) reading `/profiles/userA/photos/photo1` -> DENIED.
10. **ID Poisoning**: Creating `/profiles/userA/photos/<1500-char-id>` -> DENIED (`isValidId` <= 128 chars).
11. **Timestamp Spoofing**: Creating `/likes/userA_userB` with backdated `createdAt` (`!= request.time`) -> DENIED (`request.time` check).
12. **Audit Log Tampering**: Admin or user attempting `update` or `delete` on `/audit_logs/log1` -> DENIED.
