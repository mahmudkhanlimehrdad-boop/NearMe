import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Inbox,
  LogOut,
  Mail,
  PenSquare,
  RefreshCw,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../components/AppShell';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { useApp } from '../../contexts/AppContext';
import {
  getGmailMessage,
  GmailApiError,
  listGmailMessages,
  markGmailMessageRead,
  sendGmailMessage,
  trashGmailMessage,
} from '../../services/gmailService';
import {
  validateComposeDraft,
  type GmailComposeDraft,
  type GmailMessageSummary,
} from '../../utils/gmail';
import type { GoogleAuthErrorDetail } from '../../utils/authErrors';

type PendingConfirmation =
  | { type: 'send'; draft: GmailComposeDraft }
  | { type: 'trash'; message: GmailMessageSummary };

export const GmailPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    firebaseUser,
    language,
    gmailAccessToken,
    connectGmail,
    disconnectGmail,
  } = useApp();

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<GoogleAuthErrorDetail | null>(null);

  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<GmailComposeDraft>({ to: '', subject: '', body: '' });
  const [composeError, setComposeError] = useState('');
  const [apiError, setApiError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  const handleApiFailure = useCallback(
    (err: unknown) => {
      if (err instanceof GmailApiError && err.status === 401) {
        disconnectGmail();
        setMessages([]);
        setSelectedMessage(null);
        setApiError(t('gmail.sessionExpired'));
        return;
      }
      setApiError(err instanceof Error ? err.message : t('errors.generic'));
    },
    [disconnectGmail, t]
  );

  const loadInbox = useCallback(
    async (queryStr = activeQuery) => {
      if (!gmailAccessToken) return;
      setListLoading(true);
      setApiError('');
      try {
        const list = await listGmailMessages(gmailAccessToken, queryStr, 15);
        setMessages(list);
      } catch (err) {
        handleApiFailure(err);
      } finally {
        setListLoading(false);
      }
    },
    [activeQuery, gmailAccessToken, handleApiFailure]
  );

  useEffect(() => {
    if (gmailAccessToken) {
      void loadInbox(activeQuery);
    }
  }, [gmailAccessToken, activeQuery, loadInbox]);

  const handleConnect = async () => {
    setConnectError(null);
    setApiError('');
    setStatusNotice('');
    setConnecting(true);
    try {
      const res = await connectGmail();
      if (!res.ok && res.error) {
        setConnectError(res.error);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput.trim());
  };

  const handleSelectMessage = async (summary: GmailMessageSummary) => {
    if (!gmailAccessToken) return;
    setComposing(false);
    setComposeError('');
    setApiError('');
    setStatusNotice('');
    setSelectedMessage(summary);
    setDetailLoading(true);
    try {
      const full = await getGmailMessage(gmailAccessToken, summary.id);
      setSelectedMessage(full);
      if (summary.isUnread) {
        await markGmailMessageRead(gmailAccessToken, summary.id).catch(() => {});
        setMessages((prev) =>
          prev.map((m) =>
            m.id === summary.id
              ? { ...m, isUnread: false, labelIds: m.labelIds.filter((l) => l !== 'UNREAD') }
              : m
          )
        );
        setSelectedMessage((prev) => (prev ? { ...prev, isUnread: false } : prev));
      }
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartCompose = () => {
    setSelectedMessage(null);
    setComposing(true);
    setComposeError('');
    setStatusNotice('');
    setDraft({ to: '', subject: '', body: '' });
  };

  const handleReply = (msg: GmailMessageSummary) => {
    const emailMatch = msg.from.match(/<([^>]+)>/);
    const replyTo = emailMatch ? emailMatch[1] : msg.from;
    const replySubject = msg.subject.toLowerCase().startsWith('re:')
      ? msg.subject
      : `Re: ${msg.subject}`;
    setDraft({
      to: replyTo,
      subject: replySubject,
      body: '',
    });
    setComposeError('');
    setStatusNotice('');
    setComposing(true);
  };

  const handleRequestSend = (e: React.FormEvent) => {
    e.preventDefault();
    setComposeError('');
    setApiError('');
    const check = validateComposeDraft(draft);
    if (!check.valid) {
      if (check.reason === 'invalidEmail') setComposeError(t('errors.invalidEmail'));
      else setComposeError(t('errors.required'));
      return;
    }
    setPendingConfirm({ type: 'send', draft: { ...draft } });
  };

  const handleConfirmMutation = async () => {
    if (!gmailAccessToken || !pendingConfirm) return;
    setActionLoading(true);
    setApiError('');
    try {
      if (pendingConfirm.type === 'send') {
        await sendGmailMessage(gmailAccessToken, pendingConfirm.draft);
        setComposing(false);
        setDraft({ to: '', subject: '', body: '' });
        setStatusNotice(t('gmail.sentSuccess'));
        setPendingConfirm(null);
        await loadInbox(activeQuery);
      } else {
        const targetId = pendingConfirm.message.id;
        await trashGmailMessage(gmailAccessToken, targetId);
        setMessages((prev) => prev.filter((m) => m.id !== targetId));
        if (selectedMessage?.id === targetId) {
          setSelectedMessage(null);
        }
        setStatusNotice(t('gmail.trashedSuccess'));
        setPendingConfirm(null);
      }
    } catch (err) {
      setPendingConfirm(null);
      handleApiFailure(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#EA4335]/15 text-[#EA4335] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{t('gmail.title')}</h1>
              <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                {firebaseUser?.email || t('gmail.subtitle')}
              </p>
            </div>
          </div>

          {gmailAccessToken && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartCompose}
                className="px-4 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#FF5277]/90 transition-colors"
              >
                <PenSquare className="w-4 h-4" />
                <span>{t('gmail.compose')}</span>
              </button>
              <button
                type="button"
                onClick={() => void loadInbox(activeQuery)}
                disabled={listLoading}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-[#202737] disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
                <span>{t('gmail.refresh')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  disconnectGmail();
                  setMessages([]);
                  setSelectedMessage(null);
                  setComposing(false);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs font-medium text-[#F05265] flex items-center gap-1.5 hover:bg-[#F05265]/10"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('gmail.disconnect')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Error & Status Notices */}
        {apiError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {statusNotice && (
          <div className="p-3.5 rounded-2xl bg-[#35C98A]/15 border border-[#35C98A]/30 text-xs text-[#35C98A]">
            {statusNotice}
          </div>
        )}

        {/* Unconnected State */}
        {!gmailAccessToken ? (
          <div className="max-w-lg mx-auto rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#EA4335]/15 text-[#EA4335] flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold">{t('gmail.connectTitle')}</h2>
              <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                {t('gmail.connectDesc')}
              </p>
            </div>

            <GoogleSignInButton
              variant="gmail"
              label={connecting ? t('common.loading') : t('gmail.connectBtn')}
              loading={connecting}
              onClick={handleConnect}
              testId="gmail-connect-button"
            />

            {typeof window !== 'undefined' && window.self !== window.top && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-[#A7AFBF] space-y-1.5">
                <p>
                  {language === 'fa'
                    ? 'اگر در پیش‌نمایش قاب‌دار پنجره اتصال جیمیل مسدود یا متوقف شد، صفحه را در تب جدید باز کنید.'
                    : 'If Gmail authorization stalls inside the embedded preview, open this page in a new tab.'}
                </p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center font-semibold text-[#FF5277] hover:underline"
                >
                  {language === 'fa' ? 'باز کردن صفحه در تب جدید ↗' : 'Open in a new tab ↗'}
                </a>
              </div>
            )}

            {connectError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265] space-y-2"
              >
                <p>{connectError.message}</p>
                {connectError.isIframePopupIssue &&
                  typeof window !== 'undefined' &&
                  window.self !== window.top && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center font-semibold underline"
                    >
                      {language === 'fa'
                        ? 'باز کردن صفحه در تب جدید'
                        : 'Open sign-in in a new tab'}
                    </a>
                  )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('gmail.searchPlaceholder')}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-[#202737] text-white text-xs font-semibold hover:opacity-90"
              >
                {t('common.search')}
              </button>
              {activeQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setActiveQuery('');
                  }}
                  className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs"
                >
                  {t('gmail.clearSearch')}
                </button>
              )}
            </form>

            {/* 2-Column Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Inbox List */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A7AFBF]">
                    {t('gmail.inbox')}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">{messages.length}</span>
                </div>

                {listLoading && messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-[#A7AFBF]">
                    {t('common.loading')}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-[#A7AFBF]">
                    {t('gmail.emptyInbox')}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[540px] overflow-y-auto">
                    {messages.map((msg) => {
                      const active = selectedMessage?.id === msg.id && !composing;
                      return (
                        <button
                          key={msg.id}
                          type="button"
                          onClick={() => void handleSelectMessage(msg)}
                          className={`w-full text-start p-4 space-y-1 transition-colors ${
                            active
                              ? 'bg-[#FF5277]/10'
                              : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs truncate ${
                                msg.isUnread
                                  ? 'font-bold text-slate-900 dark:text-white'
                                  : 'font-medium text-slate-600 dark:text-[#A7AFBF]'
                              }`}
                            >
                              {msg.from}
                            </span>
                            {msg.isUnread && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#FF5277] shrink-0"
                                aria-label="Unread"
                              />
                            )}
                          </div>
                          <p
                            className={`text-sm truncate ${
                              msg.isUnread
                                ? 'font-semibold text-slate-900 dark:text-white'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {msg.subject}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#A7AFBF] line-clamp-2">
                            {msg.snippet}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reader / Compose Panel */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 min-h-[380px] flex flex-col">
                {composing ? (
                  <form onSubmit={handleRequestSend} className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                      <h2 className="font-display text-lg font-bold">{t('gmail.composeTitle')}</h2>
                      <button
                        type="button"
                        onClick={() => setComposing(false)}
                        aria-label={t('common.close')}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {composeError && (
                      <div
                        role="alert"
                        className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]"
                      >
                        {composeError}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="gmail-to"
                        className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]"
                      >
                        {t('gmail.toLabel')}
                      </label>
                      <input
                        id="gmail-to"
                        type="email"
                        required
                        value={draft.to}
                        onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                        placeholder="friend@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="gmail-subject"
                        className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]"
                      >
                        {t('gmail.subjectLabel')}
                      </label>
                      <input
                        id="gmail-subject"
                        type="text"
                        required
                        value={draft.subject}
                        onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                      />
                    </div>

                    <div className="flex-1 flex flex-col">
                      <label
                        htmlFor="gmail-body"
                        className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]"
                      >
                        {t('gmail.bodyLabel')}
                      </label>
                      <textarea
                        id="gmail-body"
                        required
                        rows={7}
                        value={draft.body}
                        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                        className="w-full flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setComposing(false)}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-medium"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#FF5277]/90"
                      >
                        <Send className="w-4 h-4" />
                        <span>{t('gmail.sendBtn')}</span>
                      </button>
                    </div>
                  </form>
                ) : selectedMessage ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
                      <div className="space-y-1 min-w-0">
                        <h2 className="font-display text-lg font-bold break-words">
                          {selectedMessage.subject}
                        </h2>
                        <p className="text-xs text-slate-600 dark:text-[#A7AFBF] break-all">
                          {selectedMessage.from}
                        </p>
                        {selectedMessage.date && (
                          <p className="text-[11px] text-slate-400">{selectedMessage.date}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReply(selectedMessage)}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-medium flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-[#2a3347]"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          <span>{t('gmail.reply')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingConfirm({ type: 'trash', message: selectedMessage })
                          }
                          className="px-3 py-2 rounded-xl bg-[#F05265]/15 text-[#F05265] text-xs font-medium flex items-center gap-1.5 hover:bg-[#F05265]/25"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('gmail.trash')}</span>
                        </button>
                      </div>
                    </div>

                    {detailLoading ? (
                      <div className="py-12 text-center text-xs text-slate-500 dark:text-[#A7AFBF]">
                        {t('common.loading')}
                      </div>
                    ) : (
                      <div className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200 break-words overflow-y-auto max-h-[420px]">
                        {selectedMessage.bodyText || selectedMessage.snippet}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500 dark:text-[#A7AFBF]">
                    <Mail className="w-8 h-8 opacity-50" />
                    <p className="text-sm font-medium">{t('gmail.selectPrompt')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Confirmation Dialog for Mutating Gmail Operations */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/15 p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-lg font-bold">
              {pendingConfirm.type === 'send'
                ? t('gmail.confirmSendTitle')
                : t('gmail.confirmTrashTitle')}
            </h3>

            {pendingConfirm.type === 'send' ? (
              <div className="space-y-2 text-xs text-slate-600 dark:text-[#A7AFBF]">
                <p>{t('gmail.confirmSendDesc')}</p>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#202737] space-y-1">
                  <p>
                    <strong className="text-slate-900 dark:text-white">
                      {t('gmail.toLabel')}:
                    </strong>{' '}
                    {pendingConfirm.draft.to}
                  </p>
                  <p>
                    <strong className="text-slate-900 dark:text-white">
                      {t('gmail.subjectLabel')}:
                    </strong>{' '}
                    {pendingConfirm.draft.subject}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 dark:text-[#A7AFBF]">
                <p>{t('gmail.confirmTrashDesc')}</p>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#202737] space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {pendingConfirm.message.subject}
                  </p>
                  <p>{pendingConfirm.message.from}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleConfirmMutation()}
                className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold disabled:opacity-50 ${
                  pendingConfirm.type === 'trash'
                    ? 'bg-[#F05265] hover:bg-[#F05265]/90'
                    : 'bg-[#FF5277] hover:bg-[#FF5277]/90'
                }`}
              >
                {actionLoading ? t('common.loading') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
