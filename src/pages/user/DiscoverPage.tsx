import React, { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, Rows3, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NearbyCandidate, PreferredGender } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { ProfileCard } from '../../components/ProfileCard';
import { GlobalDiscoverFilters, searchGlobalProfiles } from '../../services/discoveryService';
import { recordInteraction } from '../../services/matchService';
import { INTEREST_OPTIONS, SUPPORTED_PROFILE_LANGUAGES } from '../../utils/validation';

export const DiscoverPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, preferences, setMatchCelebration } = useApp();

  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<NearbyCandidate[]>([]);
  const [actingUid, setActingUid] = useState<string | null>(null);

  const [filters, setFilters] = useState<GlobalDiscoverFilters>({
    gender: preferences?.preferredGender || 'everyone',
    minAge: preferences?.minimumAge || 18,
    maxAge: preferences?.maximumAge || 55,
    country: '',
    city: '',
    language: '',
    interest: '',
    relationshipGoal: '',
    onlineOnly: false,
    verifiedOnly: false,
    sortBy: 'relevance',
  });

  const loadProfiles = useCallback(
    async (activeFilters: GlobalDiscoverFilters) => {
      if (!profile) return;
      setLoading(true);
      try {
        const list = await searchGlobalProfiles(profile, preferences, activeFilters);
        setResults(list);
      } finally {
        setLoading(false);
      }
    },
    [profile, preferences]
  );

  useEffect(() => {
    if (profile) {
      void loadProfiles(filters);
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    void loadProfiles(filters);
    setShowFilters(false);
  };

  const handleReset = () => {
    const clean: GlobalDiscoverFilters = {
      gender: 'everyone',
      minAge: 18,
      maxAge: 65,
      country: '',
      city: '',
      language: '',
      interest: '',
      relationshipGoal: '',
      onlineOnly: false,
      verifiedOnly: false,
      sortBy: 'relevance',
    };
    setFilters(clean);
    void loadProfiles(clean);
  };

  const handleInteract = async (
    item: NearbyCandidate,
    type: 'like' | 'superlike' | 'pass'
  ) => {
    if (!profile) return;
    setActingUid(item.profile.uid);
    try {
      const res = await recordInteraction({
        fromUid: profile.uid,
        fromName: profile.displayName,
        toUid: item.profile.uid,
        type,
      });
      setResults((prev) => prev.filter((r) => r.profile.uid !== item.profile.uid));
      if (res.matched && res.matchId) {
        setMatchCelebration({
          matchId: res.matchId,
          peerName: item.profile.displayName,
          peerPhoto: item.profile.mainPhotoUrl,
        });
      }
    } finally {
      setActingUid(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{t('discover.title')}</h1>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) => {
                const next = { ...filters, sortBy: e.target.value as GlobalDiscoverFilters['sortBy'] };
                setFilters(next);
                void loadProfiles(next);
              }}
              aria-label={t('discover.sortLabel')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs font-medium"
            >
              <option value="relevance">{t('discover.sortRelevance')}</option>
              <option value="active">{t('discover.sortActive')}</option>
              <option value="distance">{t('discover.sortDistance')}</option>
            </select>

            <div className="inline-flex rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs ${
                  viewMode === 'grid'
                    ? 'bg-[#FF5277] text-white'
                    : 'text-slate-600 dark:text-[#A7AFBF]'
                }`}
                aria-label={t('discover.gridView')}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs ${
                  viewMode === 'cards'
                    ? 'bg-[#FF5277] text-white'
                    : 'text-slate-600 dark:text-[#A7AFBF]'
                }`}
                aria-label={t('discover.cardsView')}
              >
                <Rows3 className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#202737] text-white text-xs font-medium whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t('discover.filters')}</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <form
            onSubmit={handleApply}
            className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-5 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.gender')}
                </label>
                <select
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value as PreferredGender })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                >
                  <option value="everyone">{t('common.genders.everyone')}</option>
                  <option value="woman">{t('common.genders.woman')}</option>
                  <option value="man">{t('common.genders.man')}</option>
                  <option value="nonbinary">{t('common.genders.nonbinary')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('discover.minAge')} – {t('discover.maxAge')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={filters.minAge}
                    onChange={(e) => setFilters({ ...filters, minAge: Math.max(18, Number(e.target.value)) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                  />
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={filters.maxAge}
                    onChange={(e) => setFilters({ ...filters, maxAge: Math.max(18, Number(e.target.value)) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.country')}
                </label>
                <input
                  type="text"
                  value={filters.country}
                  onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.city')}
                </label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.languages')}
                </label>
                <select
                  value={filters.language}
                  onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                >
                  <option value="">{t('common.all')}</option>
                  {SUPPORTED_PROFILE_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.interests')}
                </label>
                <select
                  value={filters.interest}
                  onChange={(e) => setFilters({ ...filters, interest: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                >
                  <option value="">{t('common.all')}</option>
                  {INTEREST_OPTIONS.map((i) => (
                    <option key={i} value={i}>
                      {t(`common.interestLabels.${i}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.relationshipGoals')}
                </label>
                <select
                  value={filters.relationshipGoal}
                  onChange={(e) => setFilters({ ...filters, relationshipGoal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="serious">{t('common.goals.serious')}</option>
                  <option value="casual">{t('common.goals.casual')}</option>
                  <option value="friendship">{t('common.goals.friendship')}</option>
                  <option value="networking">{t('common.goals.networking')}</option>
                </select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={filters.onlineOnly}
                    onChange={(e) => setFilters({ ...filters, onlineOnly: e.target.checked })}
                    className="accent-[#FF5277]"
                  />
                  <span>{t('discover.onlineOnly')}</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked })}
                    className="accent-[#35C98A]"
                  />
                  <span>{t('discover.verifiedOnly')}</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-medium"
              >
                {t('discover.resetFilters')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#FF5277] text-white text-xs font-semibold"
              >
                {t('discover.applyFilters')}
              </button>
            </div>
          </form>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 animate-pulse"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-10 text-center max-w-lg mx-auto space-y-3">
            <h2 className="font-display text-xl font-bold">{t('discover.emptyTitle')}</h2>
            <p className="text-sm text-slate-600 dark:text-[#A7AFBF]">{t('discover.emptyDesc')}</p>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-[#FF5277] text-white text-xs font-semibold"
            >
              {t('discover.resetFilters')}
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item) => (
              <ProfileCard
                key={item.profile.uid}
                profile={item.profile}
                compatibility={item.compatibility}
                actionDisabled={actingUid === item.profile.uid}
                onPass={() => handleInteract(item, 'pass')}
                onSuperLike={() => handleInteract(item, 'superlike')}
                onLike={() => handleInteract(item, 'like')}
              />
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <ProfileCard
              profile={results[0].profile}
              compatibility={results[0].compatibility}
              actionDisabled={actingUid === results[0].profile.uid}
              onPass={() => handleInteract(results[0], 'pass')}
              onSuperLike={() => handleInteract(results[0], 'superlike')}
              onLike={() => handleInteract(results[0], 'like')}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
};
