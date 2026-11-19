import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { LikeRecord, MatchRecord, NotificationItem, UserProfile } from '../types/nearme';
import { makePairId, sanitizeText } from '../utils/validation';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function recordInteraction(params: {
  fromUid: string;
  fromName: string;
  toUid: string;
  type: 'like' | 'superlike' | 'pass';
}): Promise<{ matched: boolean; matchId?: string; targetProfile?: UserProfile }> {
  const { fromUid, fromName, toUid, type } = params;
  const likeId = `${fromUid}_${toUid}`;
  const reverseLikeId = `${toUid}_${fromUid}`;
  const pairId = makePairId(fromUid, toUid);

  try {
    const result = await runTransaction(db, async (tx) => {
      const likeRef = doc(db, 'likes', likeId);
      const reverseRef = doc(db, 'likes', reverseLikeId);
      const matchRef = doc(db, 'matches', pairId);

      const reverseSnap = await tx.get(reverseRef);
      const existingMatchSnap = await tx.get(matchRef);

      tx.set(likeRef, {
        likeId,
        fromUid,
        toUid,
        type,
        createdAt: serverTimestamp(),
      });

      const reverseType = reverseSnap.exists() ? (reverseSnap.data() as LikeRecord).type : null;
      const isMutual =
        (type === 'like' || type === 'superlike') &&
        (reverseType === 'like' || reverseType === 'superlike');

      if (isMutual && (!existingMatchSnap.exists() || existingMatchSnap.data()?.status !== 'active')) {
        const [userA, userB] = fromUid < toUid ? [fromUid, toUid] : [toUid, fromUid];
        tx.set(matchRef, {
          matchId: pairId,
          userA,
          userB,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'conversations', pairId), {
          conversationId: pairId,
          matchId: pairId,
          userA,
          userB,
          lastMessagePreview: '',
          unreadA: 0,
          unreadB: 0,
          typingA: false,
          typingB: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        tx.set(doc(db, 'notifications', notifId), {
          notificationId: notifId,
          recipientUid: toUid,
          actorUid: fromUid,
          type: 'match',
          title: 'New Mutual Match',
          body: `${fromName} matched with you!`,
          read: false,
          link: `/messages/${pairId}`,
          createdAt: serverTimestamp(),
        });

        return { matched: true, matchId: pairId };
      }

      if (type === 'like' || type === 'superlike') {
        const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        tx.set(doc(db, 'notifications', notifId), {
          notificationId: notifId,
          recipientUid: toUid,
          actorUid: fromUid,
          type: 'like',
          title: type === 'superlike' ? 'New Super Like' : 'New Like',
          body: `${fromName} liked your profile.`,
          read: false,
          link: '/likes',
          createdAt: serverTimestamp(),
        });
      }

      return { matched: false };
    });

    let targetProfile: UserProfile | undefined;
    if (result.matched) {
      const pSnap = await getDoc(doc(db, 'profiles', toUid));
      if (pSnap.exists()) targetProfile = pSnap.data() as UserProfile;
    }
    return { ...result, targetProfile };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `likes/${likeId}`);
  }
}

export async function undoLike(fromUid: string, toUid: string): Promise<void> {
  const likeId = `${fromUid}_${toUid}`;
  try {
    await deleteDoc(doc(db, 'likes', likeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `likes/${likeId}`);
  }
}

export async function unmatchUser(uid: string, otherUid: string): Promise<void> {
  const pairId = makePairId(uid, otherUid);
  try {
    await updateDoc(doc(db, 'matches', pairId), {
      status: 'unmatched',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `matches/${pairId}`);
  }
}

export async function blockUser(blockerUid: string, blockedUid: string): Promise<void> {
  const blockId = `${blockerUid}_${blockedUid}`;
  const pairId = makePairId(blockerUid, blockedUid);
  const batch = writeBatch(db);

  batch.set(doc(db, 'blocked_users', blockId), {
    blockId,
    blockerUid,
    blockedUid,
    createdAt: serverTimestamp(),
  });

  // Immediately revoke any active match in the same flow if present
  try {
    const matchSnap = await getDoc(doc(db, 'matches', pairId));
    if (matchSnap.exists() && matchSnap.data()?.status === 'active') {
      batch.update(doc(db, 'matches', pairId), {
        status: 'unmatched',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `blocked_users/${blockId}`);
  }
}

export async function unblockUser(blockerUid: string, blockedUid: string): Promise<void> {
  const blockId = `${blockerUid}_${blockedUid}`;
  try {
    await deleteDoc(doc(db, 'blocked_users', blockId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `blocked_users/${blockId}`);
  }
}

export async function isUserBlocked(blockerUid: string, targetUid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'blocked_users', `${blockerUid}_${targetUid}`));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function submitReport(params: {
  reporterUid: string;
  targetUid: string;
  targetType: 'profile' | 'photo' | 'message' | 'privacy';
  targetId?: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reportId,
      reporterUid: params.reporterUid,
      targetUid: params.targetUid,
      targetType: params.targetType,
      ...(params.targetId ? { targetId: params.targetId } : {}),
      reason: sanitizeText(params.reason, 100),
      details: sanitizeText(params.details || '', 1000),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }
}

export async function getActiveMatchesWithProfiles(uid: string): Promise<
  Array<{ match: MatchRecord; profile: UserProfile }>
> {
  try {
    const [qA, qB] = await Promise.all([
      getDocs(query(collection(db, 'matches'), where('userA', '==', uid))),
      getDocs(query(collection(db, 'matches'), where('userB', '==', uid))),
    ]);

    const matchDocs = [...qA.docs, ...qB.docs]
      .map((d) => d.data() as MatchRecord)
      .filter((m) => m.status === 'active');

    const results: Array<{ match: MatchRecord; profile: UserProfile }> = [];
    await Promise.all(
      matchDocs.map(async (match) => {
        const otherUid = match.userA === uid ? match.userB : match.userA;
        try {
          const pSnap = await getDoc(doc(db, 'profiles', otherUid));
          if (pSnap.exists()) {
            const profile = pSnap.data() as UserProfile;
            if (profile.accountStatus === 'active') {
              results.push({ match, profile });
            }
          }
        } catch {
          // Skip inaccessible
        }
      })
    );
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'matches');
  }
}

export async function getSentLikesWithProfiles(uid: string): Promise<
  Array<{ like: LikeRecord; profile: UserProfile }>
> {
  try {
    const snap = await getDocs(query(collection(db, 'likes'), where('fromUid', '==', uid)));
    const likes = snap.docs
      .map((d) => d.data() as LikeRecord)
      .filter((l) => l.type === 'like' || l.type === 'superlike');

    const results: Array<{ like: LikeRecord; profile: UserProfile }> = [];
    await Promise.all(
      likes.map(async (like) => {
        try {
          const pSnap = await getDoc(doc(db, 'profiles', like.toUid));
          if (pSnap.exists()) {
            results.push({ like, profile: pSnap.data() as UserProfile });
          }
        } catch {
          // Skip blocked
        }
      })
    );
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'likes');
  }
}

export async function getReceivedLikesWithProfiles(uid: string): Promise<
  Array<{ like: LikeRecord; profile: UserProfile }>
> {
  try {
    const snap = await getDocs(query(collection(db, 'likes'), where('toUid', '==', uid)));
    const likes = snap.docs
      .map((d) => d.data() as LikeRecord)
      .filter((l) => l.type === 'like' || l.type === 'superlike');

    const results: Array<{ like: LikeRecord; profile: UserProfile }> = [];
    await Promise.all(
      likes.map(async (like) => {
        try {
          const pSnap = await getDoc(doc(db, 'profiles', like.fromUid));
          if (pSnap.exists()) {
            results.push({ like, profile: pSnap.data() as UserProfile });
          }
        } catch {
          // Skip blocked
        }
      })
    );
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'likes');
  }
}

export function subscribeNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as NotificationItem));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}
