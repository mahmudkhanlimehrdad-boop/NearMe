import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Ban,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  Globe,
  Heart,
  Instagram,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  AuthorizedContacts,
  ContactMethod,
  ProfilePhoto,
  UserProfile,
} from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { getUserPhotos, getUserProfile } from '../../services/profileService';
import { getAuthorizedProfileContacts } from '../../services/contactService';
import {
  blockUser,
  isUserBlocked,
  recordInteraction,
  submitReport,
  unblockUser,
} from '../../services/matchService';
import { computeCompatibility } from '../../utils/matchmaking';
import { CONTACT_METHODS, getContactExternalUrl, makePairId } from '../../utils/validation';

const METHOD_ICONS: Record<ContactMethod, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  telegram: Send,
  whatsapp: MessageSquare,
  website: Globe,
  email: Mail,
  mobile: Phone,
};

export const UserProfileViewPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid } = useParams<{ uid: string }>();
  const { firebaseUser, profile: myProfile, preferences, setMatchCelebration } = useApp();

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [authorizedContacts, setAuthorizedContacts] = useState<AuthorizedContacts>({});
  const [isMutualMatch, setIsMutualMatch] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Fake or misleading profile');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (!uid || !firebaseUser) return;
    let active = true;
    setLoading(true);
    Promise.all([
      getUserProfile(uid),
      getUserPhotos(uid, firebaseUser.uid).catch(() => []),
      getAuthorizedProfileContacts(uid, firebaseUser.uid),
      isUserBlocked(firebaseUser.uid, uid),
    ])
      .then(([prof, phList, contactRes, isBlk]) => {
        if (!active) return;
        setTargetProfile(prof);
        setPhotos(phList);
        setAuthorizedContacts(contactRes.contacts);
        setIsMutualMatch(contactRes.isMutualMatch);
        setBlocked(isBlk || contactRes.isBlocked);
        setPhotoIdx(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid, firebaseUser]);

  const handleLike = async (type: 'like' | 'superlike') => {
    if (!myProfile || !targetProfile) return;
    const res = await recordInteraction({
      fromUid: myProfile.uid,
      fromName: myProfile.displayName,
      toUid: targetProfile.uid,
      type,
    });
    if (res.matched && res.matchId) {
      setIsMutualMatch(true);
      setMatchCelebration({
        matchId: res.matchId,
        peerName: targetProfile.displayName,
        peerPhoto: targetProfile.mainPhotoUrl,
      });
      const updatedContacts = await getAuthorizedProfileContacts(targetProfile.uid, myProfile.uid);
      setAuthorizedContacts(updatedContacts.contacts);
    }
  };

  const handleBlockToggle = async () => {
    if (!firebaseUser || !targetProfile) return;
    if (blocked) {
      await unblockUser(firebaseUser.uid, targetProfile.uid);
      setBlocked(false);
      const updated = await getAuthorizedProfileContacts(targetProfile.uid, firebaseUser.uid);
      setAuthorizedContacts(updated.contacts);
    } else {
      await blockUser(firebaseUser.uid, targetProfile.uid);
      setBlocked(true);
      setIsMutualMatch(false);
      setAuthorizedContacts({});
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !targetProfile) return;
    await submitReport({
      reporterUid: firebaseUser.uid,
      targetUid: targetProfile.uid,
      targetType: 'profile',
      reason: reportReason,
      details: reportDetails,
    });
    setReportSent(true);
    setTimeout(() => {
      setReportOpen(false);
      setReportSent(false);
    }, 1000);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto p-6">
          <div className="h-96 rounded-3xl bg-white dark:bg-[#171C28] animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (!targetProfile) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto p-8 text-center space-y-4">
          <p className="text-sm text-slate-500 dark:text-[#A7AFBF]">{t('discover.emptyTitle')}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl bg-[#202737] text-white text-xs"
          >
            {t('onboarding.back')}
          </button>
        </div>
      </AppShell>
    );
  }

  const isOwn = firebaseUser?.uid === targetProfile.uid;
  const compatibility =
    myProfile && !isOwn ? computeCompatibility(myProfile, preferences, targetProfile) : null;

  const visiblePhotos =
    photos.length > 0
      ? photos
      : targetProfile.mainPhotoUrl && targetProfile.mainPhotoVisibility !== 'private'
        ? [{ photoId: 'main', url: targetProfile.mainPhotoUrl, cropX: 50, cropY: 50, zoom: 1 } as ProfilePhoto]
        : [];

  const activePhoto = visiblePhotos[photoIdx];
  const visibleContactEntries = CONTACT_METHODS.filter((m) => Boolean(authorizedContacts[m]));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden grid grid-cols-1 md:grid-cols-2">
          {/* Photo Carousel */}
          <div className="relative aspect-[4/4.5] bg-slate-100 dark:bg-[#202737]">
            {activePhoto ? (
              <img
                src={activePhoto.url}
                alt={targetProfile.displayName}
                referrerPolicy="no-referrer"
                style={{
                  objectPosition: `${activePhoto.cropX ?? 50}% ${activePhoto.cropY ?? 50}%`,
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-16 h-16 text-[#A7AFBF]" />
              </div>
            )}

            {visiblePhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => (i - 1 + visiblePhotos.length) % visiblePhotos.length)}
                  className="absolute start-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => (i + 1) % visiblePhotos.length)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {/* Profile Info */}
          <div className="p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold">
                    {targetProfile.displayName}, <span className="tabular-nums">{targetProfile.age}</span>
                  </h1>
                  {targetProfile.verificationStatus === 'verified' && (
                    <BadgeCheck className="w-5 h-5 text-[#35C98A]" />
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-[#A7AFBF] mt-1">
                  {targetProfile.city}
                  {targetProfile.country ? ` · ${targetProfile.country}` : ''}
                  {targetProfile.occupation ? ` · ${targetProfile.occupation}` : ''}
                </p>
              </div>

              {compatibility && (
                <div className="p-3.5 rounded-2xl bg-[#9B7BFF]/10 border border-[#9B7BFF]/25 space-y-1">
                  <p className="text-xs font-semibold text-[#9B7BFF] flex items-center gap-1.5 tabular-nums">
                    <Sparkles className="w-4 h-4" />
                    {t('matchmaking.scoreLabel', { score: compatibility.score })}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-[#A7AFBF]">
                    {t('matchmaking.disclaimer')}
                  </p>
                </div>
              )}

              {targetProfile.biography && (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-white/90">
                  {targetProfile.biography}
                </p>
              )}

              <div className="space-y-2 text-xs text-slate-600 dark:text-[#A7AFBF]">
                <p>
                  <strong className="text-slate-900 dark:text-white">{t('common.relationshipGoals')}:</strong>{' '}
                  {t(`common.goals.${targetProfile.relationshipGoals}`)}
                </p>
                {targetProfile.interests?.length > 0 && (
                  <p>
                    <strong className="text-slate-900 dark:text-white">{t('common.interests')}:</strong>{' '}
                    {targetProfile.interests
                      .map((i) => t(`common.interestLabels.${i}`, { defaultValue: i }))
                      .join(' · ')}
                  </p>
                )}
                {targetProfile.languages?.length > 0 && (
                  <p>
                    <strong className="text-slate-900 dark:text-white">{t('common.languages')}:</strong>{' '}
                    {targetProfile.languages.join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!isOwn && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
                {blocked ? (
                  <div className="p-3 rounded-xl bg-[#F05265]/15 text-xs text-[#F05265] flex items-center justify-between">
                    <span>{t('profile.blockedNotice')}</span>
                    <button type="button" onClick={handleBlockToggle} className="underline font-semibold">
                      {t('profile.unblockUser')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {isMutualMatch && myProfile ? (
                      <Link
                        to={`/messages/${makePairId(myProfile.uid, targetProfile.uid)}`}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF5277] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{t('likes.startChat')}</span>
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleLike('like')}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF5277] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Heart className="w-4 h-4" />
                          <span>{t('nearby.like')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLike('superlike')}
                          className="py-2.5 px-4 rounded-xl bg-[#9B7BFF]/15 text-[#9B7BFF] text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>{t('nearby.superlike')}</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleBlockToggle}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF] hover:text-[#F05265]"
                      aria-label={t('profile.blockUser')}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF] hover:text-[#F2B749]"
                      aria-label={t('profile.reportUser')}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contact Me Section (Authorized Channels Only) */}
        <section
          aria-labelledby="contact-me-heading"
          className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="contact-me-heading" className="font-display text-lg font-bold">
                {t('profile.contactMeTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                {t('profile.contactMeSubtitle')}
              </p>
            </div>
            {isOwn && (
              <Link
                to="/profile/contacts"
                className="text-xs font-semibold text-[#FF5277] hover:underline"
              >
                {t('profile.myContacts')}
              </Link>
            )}
          </div>

          {blocked || visibleContactEntries.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
              {isMutualMatch ? t('profile.noMatchContacts') : t('profile.noPublicContacts')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleContactEntries.map((method) => {
                const value = authorizedContacts[method]!;
                const href = getContactExternalUrl(method, value);
                const Icon = METHOD_ICONS[method];
                return href ? (
                  <a
                    key={method}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 hover:border-[#FF5277]/50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 text-[#FF5277] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 dark:text-[#A7AFBF]">
                          {t(`contacts.${method}`)}
                        </p>
                        <p className="text-xs font-semibold truncate">{value}</p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#A7AFBF] shrink-0" />
                  </a>
                ) : null;
              })}
            </div>
          )}
        </section>

        {/* Report Modal */}
        {reportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form
              onSubmit={handleReport}
              className="max-w-md w-full rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-4"
            >
              <h3 className="font-display text-lg font-bold">{t('profile.reportUser')}</h3>
              {reportSent ? (
                <p className="text-sm text-[#35C98A]">{t('legal.contactSuccess')}</p>
              ) : (
                <>
                  <input
                    type="text"
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                  />
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder={t('legal.messageLabel')}
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
                </>
              )}
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
};
