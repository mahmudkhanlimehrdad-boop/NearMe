import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Heart, MessageCircle, RotateCcw, Sparkles, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LikeRecord, MatchRecord, UserProfile } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import {
  getActiveMatchesWithProfiles,
  getReceivedLikesWithProfiles,
  getSentLikesWithProfiles,
  recordInteraction,
  undoLike,
} from '../../services/matchService';

export const LikesMatchesPage: React.FC<{ initialTab?: 'matches' | 'received' | 'sent' }> = ({
  initialTab = 'matches',
}) => {
  const { t } = useTranslation();
  const { firebaseUser, account, profile, setMatchCelebration } = useApp();

  const [tab, setTab] = useState<'matches' | 'received' | 'sent'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Array<{ match: MatchRecord; profile: UserProfile }>>([]);
  const [received, setReceived] = useState<Array<{ like: LikeRecord; profile: UserProfile }>>([]);
  const [sent, setSent] = useState<Array<{ like: LikeRecord; profile: UserProfile }>>([]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const [mList, rList, sList] = await Promise.all([
        getActiveMatchesWithProfiles(firebaseUser.uid),
        getReceivedLikesWithProfiles(firebaseUser.uid),
        getSentLikesWithProfiles(firebaseUser.uid),
      ]);
      setMatches(mList);
      setReceived(rList);
      setSent(sList);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUndo = async (toUid: string) => {
    if (!firebaseUser) return;
    await undoLike(firebaseUser.uid, toUid);
    setSent((prev) => prev.filter((item) => item.profile.uid !== toUid));
  };

  const handleLikeBack = async (targetProfile: UserProfile) => {
    if (!profile) return;
    const res = await recordInteraction({
      fromUid: profile.uid,
      fromName: profile.displayName,
      toUid: targetProfile.uid,
      type: 'like',
    });
    if (res.matched && res.matchId) {
      setMatchCelebration({
        matchId: res.matchId,
        peerName: targetProfile.displayName,
        peerPhoto: targetProfile.mainPhotoUrl,
      });
    }
    await loadData();
  };

  const isVip = account?.membershipTier === 'vip';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{t('likes.title')}</h1>

          <div className="inline-flex rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-1">
            <button
              type="button"
              onClick={() => setTab('matches')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'matches' ? 'bg-[#FF5277] text-white' : 'text-slate-600 dark:text-[#A7AFBF]'
              }`}
            >
              {t('likes.matchesTab')} ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('received')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'received' ? 'bg-[#FF5277] text-white' : 'text-slate-600 dark:text-[#A7AFBF]'
              }`}
            >
              {t('likes.receivedTab')} ({received.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('sent')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'sent' ? 'bg-[#FF5277] text-white' : 'text-slate-600 dark:text-[#A7AFBF]'
              }`}
            >
              {t('likes.sentTab')} ({sent.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-white dark:bg-[#171C28] animate-pulse" />
            ))}
          </div>
        ) : tab === 'matches' ? (
          matches.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-10 text-center space-y-3">
              <Heart className="w-10 h-10 text-[#FF5277] mx-auto" />
              <h2 className="font-display text-xl font-bold">{t('likes.emptyMatches')}</h2>
              <p className="text-sm text-slate-600 dark:text-[#A7AFBF] max-w-md mx-auto">
                {t('likes.emptyMatchesDesc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {matches.map(({ match, profile: peer }) => (
                <div
                  key={match.matchId}
                  className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-4 flex flex-col justify-between gap-4"
                >
                  <Link to={`/profile/${peer.uid}`} className="flex items-center gap-3.5">
                    <div className="w-16 h-16 rounded-2xl bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                      {peer.mainPhotoUrl ? (
                        <img
                          src={peer.mainPhotoUrl}
                          alt={peer.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-[#A7AFBF]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold truncate">
                        {peer.displayName}, {peer.age}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#A7AFBF] truncate">
                        {peer.city}, {peer.country}
                      </p>
                    </div>
                  </Link>
                  <div className="flex gap-2">
                    <Link
                      to={`/messages/${match.matchId}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#FF5277] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{t('likes.startChat')}</span>
                    </Link>
                    <Link
                      to={`/profile/${peer.uid}`}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-medium"
                    >
                      {t('nearby.viewProfile')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'received' ? (
          !isVip ? (
            <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-amber-500/30 p-8 text-center space-y-4">
              <Crown className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="font-display text-xl font-bold">{t('likes.vipUnlockTitle')}</h2>
              <p className="text-sm text-slate-600 dark:text-[#A7AFBF] max-w-md mx-auto">
                {t('likes.vipUnlockDesc')} ({received.length})
              </p>
              <Link
                to="/subscription"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold"
              >
                {t('likes.upgradeVip')}
              </Link>
            </div>
          ) : received.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-10 text-center text-sm text-slate-500 dark:text-[#A7AFBF]">
              {t('likes.emptyLikes')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {received.map(({ like, profile: peer }) => (
                <div
                  key={like.likeId}
                  className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-4 space-y-4"
                >
                  <Link to={`/profile/${peer.uid}`} className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                      {peer.mainPhotoUrl ? (
                        <img
                          src={peer.mainPhotoUrl}
                          alt={peer.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-[#A7AFBF]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold truncate">
                        {peer.displayName}, {peer.age}
                      </p>
                      <p className="text-xs text-[#9B7BFF] flex items-center gap-1">
                        {like.type === 'superlike' && <Sparkles className="w-3 h-3" />}
                        <span>{like.type === 'superlike' ? t('nearby.superlike') : t('nearby.like')}</span>
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleLikeBack(peer)}
                    className="w-full py-2 rounded-xl bg-[#FF5277] text-white text-xs font-semibold"
                  >
                    {t('nearby.like')}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : sent.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-10 text-center text-sm text-slate-500 dark:text-[#A7AFBF]">
            {t('likes.emptyLikes')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sent.map(({ like, profile: peer }) => (
              <div
                key={like.likeId}
                className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between gap-3"
              >
                <Link to={`/profile/${peer.uid}`} className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                    {peer.mainPhotoUrl ? (
                      <img
                        src={peer.mainPhotoUrl}
                        alt={peer.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-[#A7AFBF]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {peer.displayName}, {peer.age}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#A7AFBF] truncate">{peer.city}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleUndo(peer.uid)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF] hover:text-[#F05265]"
                  aria-label="Undo Like"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
