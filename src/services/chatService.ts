import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { ChatMessage, Conversation, UserProfile } from '../types/nearme';
import { sanitizeText } from '../utils/validation';
import { db, handleFirestoreError, OperationType, storage } from './firebase';

export interface ConversationWithPeer {
  conversation: Conversation;
  peer: UserProfile | null;
}

export function subscribeConversations(
  uid: string,
  onData: (items: Conversation[]) => void
): Unsubscribe {
  const listA = new Map<string, Conversation>();
  const listB = new Map<string, Conversation>();

  const emit = () => {
    const merged = new Map<string, Conversation>([...listA, ...listB]);
    const sorted = Array.from(merged.values()).sort((a, b) => {
      const ta = (a.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      const tb = (b.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      return tb - ta;
    });
    onData(sorted);
  };

  const unsubA = onSnapshot(
    query(collection(db, 'conversations'), where('userA', '==', uid)),
    (snap) => {
      listA.clear();
      snap.docs.forEach((d) => listA.set(d.id, d.data() as Conversation));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
  );

  const unsubB = onSnapshot(
    query(collection(db, 'conversations'), where('userB', '==', uid)),
    (snap) => {
      listB.clear();
      snap.docs.forEach((d) => listB.set(d.id, d.data() as Conversation));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
  );

  return () => {
    unsubA();
    unsubB();
  };
}

export function subscribeMessages(
  conversationId: string,
  onData: (messages: ChatMessage[]) => void
): Unsubscribe {
  const path = `conversations/${conversationId}/messages`;
  return onSnapshot(
    query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc')),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ChatMessage));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function sendChatMessage(params: {
  conversation: Conversation;
  senderUid: string;
  senderName: string;
  text?: string;
  imageFile?: File;
}): Promise<void> {
  const { conversation, senderUid, senderName, text, imageFile } = params;
  const recipientUid = conversation.userA === senderUid ? conversation.userB : conversation.userA;
  const cleanText = sanitizeText(text || '', 2000);
  if (!cleanText && !imageFile) return;

  let imageUrl = '';
  if (imageFile) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
      throw new Error('errors.invalidImageType');
    }
    if (imageFile.size > 8 * 1024 * 1024) {
      throw new Error('errors.imageTooLarge');
    }
    const fileRef = ref(
      storage,
      `conversations/${conversation.conversationId}/attachments/${senderUid}/${Date.now()}_${imageFile.name}`
    );
    await uploadBytes(fileRef, imageFile, { contentType: imageFile.type });
    imageUrl = await getDownloadURL(fileRef);
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isSenderA = conversation.userA === senderUid;
  const nextUnreadA = isSenderA ? conversation.unreadA || 0 : (conversation.unreadA || 0) + 1;
  const nextUnreadB = isSenderA ? (conversation.unreadB || 0) + 1 : conversation.unreadB || 0;

  const batch = writeBatch(db);
  batch.set(doc(db, 'conversations', conversation.conversationId, 'messages', messageId), {
    messageId,
    conversationId: conversation.conversationId,
    senderUid,
    recipientUid,
    ...(cleanText ? { text: cleanText } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    read: false,
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'conversations', conversation.conversationId), {
    lastMessagePreview: (cleanText || '📷 Image').slice(0, 200),
    lastSenderUid: senderUid,
    unreadA: nextUnreadA,
    unreadB: nextUnreadB,
    ...(isSenderA ? { typingA: false } : { typingB: false }),
    updatedAt: serverTimestamp(),
  });

  const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  batch.set(doc(db, 'notifications', notifId), {
    notificationId: notifId,
    recipientUid,
    actorUid: senderUid,
    type: 'message',
    title: senderName,
    body: (cleanText || 'Sent an image').slice(0, 120),
    read: false,
    link: `/messages/${conversation.conversationId}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `conversations/${conversation.conversationId}/messages`);
  }
}

export async function markConversationRead(
  conversation: Conversation,
  readerUid: string,
  unreadMessages: ChatMessage[]
): Promise<void> {
  const isA = conversation.userA === readerUid;
  const batch = writeBatch(db);
  let hasChanges = false;

  if ((isA && (conversation.unreadA || 0) > 0) || (!isA && (conversation.unreadB || 0) > 0)) {
    batch.update(doc(db, 'conversations', conversation.conversationId), {
      ...(isA ? { unreadA: 0 } : { unreadB: 0 }),
      updatedAt: serverTimestamp(),
    });
    hasChanges = true;
  }

  for (const m of unreadMessages) {
    if (!m.read && m.recipientUid === readerUid) {
      batch.update(
        doc(db, 'conversations', conversation.conversationId, 'messages', m.messageId),
        { read: true }
      );
      hasChanges = true;
    }
  }

  if (!hasChanges) return;
  try {
    await batch.commit();
  } catch {
    // Ignore minor read receipt race
  }
}

export async function setTypingStatus(
  conversation: Conversation,
  uid: string,
  isTyping: boolean
): Promise<void> {
  const isA = conversation.userA === uid;
  try {
    await updateDoc(doc(db, 'conversations', conversation.conversationId), {
      ...(isA ? { typingA: isTyping } : { typingB: isTyping }),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore transient typing indicator error
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    const msgs = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
    for (const m of msgs.docs) {
      await deleteDoc(m.ref);
    }
    await deleteDoc(doc(db, 'conversations', conversationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `conversations/${conversationId}`);
  }
}

export async function fetchConversationPeer(
  conversation: Conversation,
  viewerUid: string
): Promise<UserProfile | null> {
  const peerUid = conversation.userA === viewerUid ? conversation.userB : conversation.userA;
  try {
    const snap = await getDoc(doc(db, 'profiles', peerUid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch {
    return null;
  }
}
