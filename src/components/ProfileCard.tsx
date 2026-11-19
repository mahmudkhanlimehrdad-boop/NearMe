import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Heart, MapPin, Sparkles, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CompatibilityResult, UserProfile } from '../types/nearme';
import { formatApproxDistance } from '../utils/geo';

interface ProfileCardProps {
  profile: UserProfile;
  distanceKm?: number;
  compatibility?: CompatibilityResult;
  onLike?: () => void;
  onSuperLike?: () => void;
  onPass?: () => void;
  compact?: boolean;
  actionDisabled?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  distanceKm,
  compatibility,
  onLike,
  onSuperLike,
  onPass,
  compact = false,
  actionDisabled = false,
}) => {
  const { t } = useTranslation();

  const visibleInterests = (profile.interests || []).slice(0, 4);
  const topReason = compatibility?.reasons?.[0];

  return (
    <article
      data-testid={`profile-card-${profile.uid}`}
      className="group rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col transition-all hover:border-[#FF5277]/40"
    >
      {/* Photo container */}
      <Link
        to={`/profile/${profile.uid}`}
        className={`relative block w-full overflow-hidden bg-slate-100 dark:bg-[#202737] ${
          compact ? 'aspect-[4/4.2]' : 'aspect-[4/4.6]'
        }`}
      >
        {profile.mainPhotoUrl && profile.mainPhotoVisibility !== 'private' ? (
          <img
            src={profile.mainPhotoUrl}
            alt={profile.displayName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#FF5277]/15 via-[#171C28] to-[#9B7BFF]/15">
            <User className="w-12 h-12 text-[#A7AFBF]" />
          </div>
        )}

        {/* Top subtle status row */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none">
          {typeof distanceKm === 'number' && distanceKm > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D1018]/80 backdrop-blur-md text-white text-xs font-medium tabular-nums">
              <MapPin className="w-3.5 h-3.5 text-[#FF5277]" />
              {formatApproxDistance(distanceKm)}
            </span>
          ) : (
            <span />
          )}

          {profile.isOnline && (
            <span className="px-2.5 py-1 rounded-lg bg-[#0D1018]/80 backdrop-blur-md text-[#35C98A] text-xs font-medium">
              {t('messages.online')}
            </span>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0D1018]/90 via-[#0D1018]/40 to-transparent pointer-events-none" />

        <div className="absolute bottom-3 inset-x-4 text-white">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-lg font-bold truncate">
              {profile.displayName}, <span className="tabular-nums">{profile.age}</span>
            </h3>
            {profile.verificationStatus === 'verified' && (
              <BadgeCheck
                className="w-5 h-5 text-[#35C98A] shrink-0"
                aria-label={t('profile.verified')}
              />
            )}
          </div>
          <p className="text-xs text-white/80 truncate">
            {profile.city}
            {profile.country ? ` · ${profile.country}` : ''}
          </p>
        </div>
      </Link>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {compatibility && (
            <div className="text-xs font-medium text-[#9B7BFF] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums">
                {t('matchmaking.scoreLabel', { score: compatibility.score })}
              </span>
            </div>
          )}

          {profile.biography && (
            <p className="text-sm text-slate-600 dark:text-[#A7AFBF] line-clamp-2 leading-relaxed">
              {profile.biography}
            </p>
          )}

          {visibleInterests.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-[#A7AFBF] truncate">
              {visibleInterests
                .map((item) => t(`common.interestLabels.${item}`, { defaultValue: item }))
                .join(' · ')}
            </p>
          )}

          {topReason && (
            <p className="text-[11px] text-slate-400 dark:text-[#A7AFBF]/80 truncate">
              {t(`matchmaking.reasons.${topReason.key}`, {
                items: (topReason.items || [])
                  .map((it) => t(`common.interestLabels.${it}`, { defaultValue: it }))
                  .join(', '),
              })}
            </p>
          )}
        </div>

        {/* Actions */}
        {(onPass || onLike || onSuperLike) && (
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-white/5">
            {onPass && (
              <button
                type="button"
                disabled={actionDisabled}
                onClick={onPass}
                aria-label={t('nearby.pass')}
                className="flex-1 min-h-[42px] rounded-xl bg-slate-100 dark:bg-[#202737] hover:bg-slate-200 dark:hover:bg-[#2a3347] text-slate-600 dark:text-[#A7AFBF] flex items-center justify-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                <span>{t('nearby.pass')}</span>
              </button>
            )}
            {onSuperLike && (
              <button
                type="button"
                disabled={actionDisabled}
                onClick={onSuperLike}
                aria-label={t('nearby.superlike')}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#9B7BFF]/15 hover:bg-[#9B7BFF]/25 text-[#9B7BFF] flex items-center justify-center gap-1 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                {!compact && <span>{t('nearby.superlike')}</span>}
              </button>
            )}
            {onLike && (
              <button
                type="button"
                disabled={actionDisabled}
                onClick={onLike}
                aria-label={t('nearby.like')}
                className="flex-1 min-h-[42px] rounded-xl bg-[#FF5277] hover:bg-[#FF5277]/90 text-white flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Heart className="w-4 h-4" />
                <span>{t('nearby.like')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
