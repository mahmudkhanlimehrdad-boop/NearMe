import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Ban,
  Check,
  CheckCheck,
  Flag,
  ImagePlus,
  MessageCircle,
  Send,
  Smile,
  Trash2,
  User,
  UserMinus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage, Conversation, UserProfile } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import {
  deleteConversation,
  fetchConversationPeer,
  markConversationRead,
  sendChatMessage,
  setTypingStatus,
  subscribeConversations,
  subscribeMessages,
} from '../../services/chatService';
import { blockUser, submitReport, unmatchUser } from '../../services/matchService';

const QUICK_EMOJIS = ['👋', '😊', '✨', '❤️', '☕', '🌍', '🎵', '🙌'];

export const MessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { firebaseUser, profile } = useApp();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [peers, setPeers] = useState<Record<string, UserProfile | null>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate behavior');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeConversations(firebaseUser.uid, (list) => {
      setConversations(list);
      list.forEach((conv) => {
        if (!peers[conv.conversationId]) {
          void fetchConversationPeer(conv, firebaseUser.uid).then((p) => {
            setPeers((prev) => ({ ...prev, [conv.conversationId]: p }));
          });
        }
      });
    });
    return () => unsub();
  }, [firebaseUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConv = conversations.find((c) => c.conversationId === conversationId) || null;
  const activePeer = activeConv ? peers[activeConv.conversationId] : null;

  useEffect(() => {
    if (!activeConv || !firebaseUser) {
      setMessages([]);
      return;
    }
    const unsub = subscribeMessages(activeConv.conversationId, (msgs) => {
      setMessages(msgs);
      void markConversationRead(activeConv, firebaseUser.uid, msgs);
    });
    return () => unsub();
  }, [activeConv?.conversationId, firebaseUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleTyping = (val: string) => {
    setText(val);
    if (!activeConv || !firebaseUser) return;
    void setTypingStatus(activeConv, firebaseUser.uid, val.length > 0);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      if (activeConv && firebaseUser) {
        void setTypingStatus(activeConv, firebaseUser.uid, false);
      }
    }, 2500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !firebaseUser || !profile || !text.trim()) return;
    const msgText = text;
    setText('');
    setShowEmojis(false);
    setSending(true);
    try {
      await sendChatMessage({
        conversation: activeConv,
        senderUid: firebaseUser.uid,
        senderName: profile.displayName,
        text: msgText,
      });
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv || !firebaseUser || !profile) return;
    setSending(true);
    try {
      await sendChatMessage({
        conversation: activeConv,
        senderUid: firebaseUser.uid,
        senderName: profile.displayName,
        imageFile: file,
      });
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  const handleUnmatch = async () => {
    if (!activeConv || !firebaseUser || !activePeer) return;
    await unmatchUser(firebaseUser.uid, activePeer.uid);
    navigate('/messages');
  };

  const handleBlock = async () => {
    if (!activeConv || !firebaseUser || !activePeer) return;
    await blockUser(firebaseUser.uid, activePeer.uid);
    navigate('/messages');
  };

  const handleDeleteConv = async () => {
    if (!activeConv) return;
    await deleteConversation(activeConv.conversationId);
    navigate('/messages');
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !activePeer) return;
    await submitReport({
      reporterUid: firebaseUser.uid,
      targetUid: activePeer.uid,
      targetType: 'message',
      targetId: activeConv?.conversationId,
      reason: reportReason,
    });
    setReportOpen(false);
  };

  const peerIsTyping = activeConv && firebaseUser
    ? activeConv.userA === firebaseUser.uid
      ? Boolean(activeConv.typingB)
      : Boolean(activeConv.typingA)
    : false;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {!isOnline && (
          <div className="mb-4 p-3 rounded-xl bg-[#F2B749]/15 border border-[#F2B749]/30 text-xs text-[#F2B749]">
            {t('messages.offlineNotice')}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[70vh]">
          {/* Conversation List */}
          <aside className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <h1 className="font-display text-lg font-bold">{t('messages.conversationsTitle')}</h1>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {conversations.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <MessageCircle className="w-8 h-8 text-[#A7AFBF] mx-auto" />
                  <p className="text-sm font-semibold">{t('messages.emptyConversations')}</p>
                  <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                    {t('messages.emptyConversationsDesc')}
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const peer = peers[conv.conversationId];
                  const unread =
                    firebaseUser?.uid === conv.userA ? conv.unreadA || 0 : conv.unreadB || 0;
                  const active = conv.conversationId === activeConv?.conversationId;
                  return (
                    <Link
                      key={conv.conversationId}
                      to={`/messages/${conv.conversationId}`}
                      className={`p-3.5 flex items-center gap-3 transition-colors ${
                        active
                          ? 'bg-[#FF5277]/10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                        {peer?.mainPhotoUrl ? (
                          <img
                            src={peer.mainPhotoUrl}
                            alt={peer.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-[#A7AFBF]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">
                            {peer?.displayName || t('common.loading')}
                          </p>
                          {unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF5277] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                              {unread}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-[#A7AFBF] truncate">
                          {conv.lastMessagePreview || t('messages.emptyThread')}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </aside>

          {/* Chat Thread */}
          <section className="md:col-span-2 rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
            {!activeConv ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-[#A7AFBF] space-y-2">
                <MessageCircle className="w-10 h-10 opacity-50" />
                <p className="text-sm">{t('messages.selectPrompt')}</p>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
                  <Link
                    to={activePeer ? `/profile/${activePeer.uid}` : '#'}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                      {activePeer?.mainPhotoUrl ? (
                        <img
                          src={activePeer.mainPhotoUrl}
                          alt={activePeer.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-[#A7AFBF]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm truncate">
                        {activePeer?.displayName || '...'}
                      </p>
                      <p className="text-[11px] text-[#35C98A]">
                        {peerIsTyping
                          ? t('messages.typing')
                          : activePeer?.isOnline
                            ? t('messages.online')
                            : activePeer?.city || ''}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleUnmatch}
                      title={t('messages.unmatch')}
                      aria-label={t('messages.unmatch')}
                      className="p-2 rounded-lg text-slate-500 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleBlock}
                      title={t('profile.blockUser')}
                      aria-label={t('profile.blockUser')}
                      className="p-2 rounded-lg text-slate-500 dark:text-[#A7AFBF] hover:text-[#F05265]"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      title={t('profile.reportUser')}
                      aria-label={t('profile.reportUser')}
                      className="p-2 rounded-lg text-slate-500 dark:text-[#A7AFBF] hover:text-[#F2B749]"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteConv}
                      title={t('messages.deleteConversation')}
                      aria-label={t('messages.deleteConversation')}
                      className="p-2 rounded-lg text-slate-500 dark:text-[#A7AFBF] hover:text-[#F05265]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[55vh]">
                  {messages.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 dark:text-[#A7AFBF] py-8">
                      {t('messages.emptyThread')}
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderUid === firebaseUser?.uid;
                      return (
                        <div
                          key={m.messageId}
                          className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm space-y-1.5 ${
                              mine
                                ? 'bg-[#FF5277] text-white'
                                : 'bg-slate-100 dark:bg-[#202737] text-slate-900 dark:text-white'
                            }`}
                          >
                            {m.imageUrl && (
                              <img
                                src={m.imageUrl}
                                alt="Attachment"
                                className="max-h-56 rounded-xl object-cover"
                              />
                            )}
                            {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                            {mine && (
                              <div className="flex items-center justify-end gap-1 text-[10px] opacity-80">
                                {m.read ? (
                                  <>
                                    <CheckCheck className="w-3 h-3" />
                                    <span>{t('messages.read')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>{t('messages.sent')}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Emoji Popover */}
                {showEmojis && (
                  <div className="px-4 py-2 border-t border-slate-200 dark:border-white/10 flex flex-wrap gap-2 bg-slate-50 dark:bg-[#131823]">
                    {QUICK_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setText((prev) => `${prev}${em}`)}
                        className="text-lg hover:scale-110 transition-transform"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={handleSend}
                  className="p-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setShowEmojis((v) => !v)}
                    className="p-2.5 rounded-xl text-slate-500 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5"
                    aria-label="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <label
                    className="p-2.5 rounded-xl text-slate-500 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                    aria-label={t('messages.attachImage')}
                  >
                    <ImagePlus className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={sending}
                    />
                  </label>

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder={t('messages.typePlaceholder')}
                    disabled={!isOnline || sending}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                  />

                  <button
                    type="submit"
                    disabled={!isOnline || sending || !text.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4 rtl:rotate-180" />
                    <span className="hidden sm:inline">{t('messages.send')}</span>
                  </button>
                </form>
              </>
            )}
          </section>
        </div>

        {/* Report Modal */}
        {reportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form
              onSubmit={handleReportSubmit}
              className="max-w-md w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-bold">{t('profile.reportUser')}</h2>
              <input
                type="text"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F05265] text-white text-xs font-semibold"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
};
