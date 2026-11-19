import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  doc,
  writeBatch,
  where,
} from 'firebase/firestore';
import type {
  AdminSettings,
  AuditLog,
  MatchRecord,
  PaymentRecord,
  ProfilePhoto,
  ReportRecord,
  SubscriptionRecord,
  UserAccount,
  UserProfile,
} from '../types/nearme';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface AdminDashboardData {
  users: UserAccount[];
  profiles: UserProfile[];
  matches: MatchRecord[];
  reports: ReportRecord[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
  auditLogs: AuditLog[];
  settings: AdminSettings | null;
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  try {
    const [
      usersSnap,
      profilesSnap,
      matchesSnap,
      reportsSnap,
      subsSnap,
      paymentsSnap,
      logsSnap,
      settingsSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(200))),
      getDocs(query(collection(db, 'profiles'), limit(200))),
      getDocs(query(collection(db, 'matches'), limit(200))),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'subscriptions'), limit(100))),
      getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'admin_settings'), limit(1))),
    ]);

    return {
      users: usersSnap.docs.map((d) => d.data() as UserAccount),
      profiles: profilesSnap.docs.map((d) => d.data() as UserProfile),
      matches: matchesSnap.docs.map((d) => d.data() as MatchRecord),
      reports: reportsSnap.docs.map((d) => d.data() as ReportRecord),
      subscriptions: subsSnap.docs.map((d) => d.data() as SubscriptionRecord),
      payments: paymentsSnap.docs.map((d) => d.data() as PaymentRecord),
      auditLogs: logsSnap.docs.map((d) => d.data() as AuditLog),
      settings: settingsSnap.docs[0] ? (settingsSnap.docs[0].data() as AdminSettings) : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin_dashboard');
  }
}

export async function fetchPendingModerationPhotos(): Promise<ProfilePhoto[]> {
  try {
    const profilesSnap = await getDocs(query(collection(db, 'profiles'), limit(50)));
    const allPhotos: ProfilePhoto[] = [];
    await Promise.all(
      profilesSnap.docs.map(async (p) => {
        const photosSnap = await getDocs(
          query(collection(db, 'profiles', p.id, 'photos'), where('moderationStatus', 'in', ['pending', 'flagged']))
        );
        photosSnap.docs.forEach((ph) => allPhotos.push(ph.data() as ProfilePhoto));
      })
    );
    return allPhotos;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'profiles/*/photos');
  }
}

async function writeAuditLog(
  actorUid: string,
  action: string,
  details: string,
  targetUid?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db, 'audit_logs', logId), {
    logId,
    actorUid,
    action,
    ...(targetUid ? { targetUid } : {}),
    details,
    createdAt: serverTimestamp(),
  });
}

export async function adminSetAccountStatus(
  actorUid: string,
  targetUid: string,
  status: 'active' | 'suspended' | 'banned'
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', targetUid), {
    accountStatus: status,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'profiles', targetUid), {
    accountStatus: status,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    await writeAuditLog(actorUid, `account_${status}`, `Updated account status to ${status}`, targetUid);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminVerifyProfile(actorUid: string, targetUid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'profiles', targetUid), {
    verificationStatus: 'verified',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', targetUid), {
    selfieVerificationStatus: 'verified',
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    await writeAuditLog(actorUid, 'profile_verified', 'Approved identity verification', targetUid);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${targetUid}`);
  }
}

export async function adminModeratePhoto(
  actorUid: string,
  ownerUid: string,
  photoId: string,
  moderationStatus: 'approved' | 'rejected'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'profiles', ownerUid, 'photos', photoId), {
      moderationStatus,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      actorUid,
      `photo_${moderationStatus}`,
      `Moderated photo ${photoId} as ${moderationStatus}`,
      ownerUid
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${ownerUid}/photos/${photoId}`);
  }
}

export async function adminResolveReport(
  actorUid: string,
  reportId: string,
  targetUid: string,
  status: 'resolved' | 'dismissed',
  resolutionNote: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      resolutionNote,
      reviewedBy: actorUid,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(actorUid, `report_${status}`, `Report ${reportId}: ${resolutionNote}`, targetUid);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function adminUpdatePlatformSettings(
  actorUid: string,
  settings: Omit<AdminSettings, 'updatedBy' | 'updatedAt'>
): Promise<void> {
  try {
    await setDoc(doc(db, 'admin_settings', 'platform'), {
      ...settings,
      updatedBy: actorUid,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(actorUid, 'platform_settings_updated', 'Updated global platform configuration');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'admin_settings/platform');
  }
}
