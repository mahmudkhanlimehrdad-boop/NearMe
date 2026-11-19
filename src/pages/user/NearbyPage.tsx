import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, LayoutGrid, MapPin, Pause, Radar, RefreshCw, Shield, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NearbyCandidate } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { ProfileCard } from '../../components/ProfileCard';
import {
  disableNearbyLocation,
  searchNearbyProfiles,
  updateNearbyLocation,
} from '../../services/discoveryService';
import { recordInteraction } from '../../services/matchService';
import {
  deterministicRadarPosition,
  formatApproxDistance,
  getNextRadiusSuggestions,
  RADIUS_OPTIONS_KM,
} from '../../utils/geo';
import compassEmptyImg from '../../assets/images/nearme_compass_empty_1795103946118.jpg';

export const NearbyPage: React.FC<{ initialMode?: 'cards' | 'radar' }> = ({
  initialMode = 'cards',
}) => {
  const { t } = useTranslation();
  const { profile, preferences, setMatchCelebration, refreshUserData } = useApp();

  const [mode, setMode] = useState<'cards' | 'radar'>(initialMode);
  const [radiusKm, setRadiusKm] = useState<number>(preferences?.searchRadiusKm || 10);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyEnabled, setNearbyEnabled] = useState<boolean>(Boolean(preferences?.nearbyEnabled));
  const [permissionError, setPermissionError] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<NearbyCandidate[]>([]);
  const [selectedRadarCandidate, setSelectedRadarCandidate] = useState<NearbyCandidate | null>(null);
  const [actingUid, setActingUid] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (preferences) {
      setRadiusKm(preferences.searchRadiusKm || 10);
      setNearbyEnabled(Boolean(preferences.nearbyEnabled));
    }
  }, [preferences]);

  const runNearbySearch = useCallback(
    async (centerLat: number, centerLng: number, targetRadius: number) => {
      if (!profile) return;
      setLoading(true);
      try {
        const res = await searchNearbyProfiles({
          viewerProfile: profile,
          viewerPrefs: preferences,
          centerLat,
          centerLng,
          radiusKm: targetRadius,
        });
        setCandidates(res);
      } finally {
        setLoading(false);
      }
    },
    [profile, preferences]
  );

  const requestAndEnableNearby = useCallback(
    async (targetRadius: number = radiusKm) => {
      if (!profile) return;
      if (!('geolocation' in navigator)) {
        setPermissionError(t('nearby.permissionDenied'));
        return;
      }
      setPermissionError('');
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lng: longitude });
          setNearbyEnabled(true);
          try {
            await updateNearbyLocation(profile.uid, latitude, longitude, targetRadius);
            await refreshUserData();
            await runNearbySearch(latitude, longitude, targetRadius);
          } catch {
            setLoading(false);
          }
        },
        () => {
          setPermissionError(t('nearby.permissionDenied'));
          setLoading(false);
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    },
    [profile, radiusKm, refreshUserData, runNearbySearch, t]
  );

  useEffect(() => {
    if (nearbyEnabled && profile && !coords && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(next);
          void runNearbySearch(next.lat, next.lng, radiusKm);
        },
        () => {
          setPermissionError(t('nearby.permissionDenied'));
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, [nearbyEnabled, profile, coords, radiusKm, runNearbySearch, t]);

  const handlePauseNearby = async () => {
    if (!profile) return;
    await disableNearbyLocation(profile.uid);
    setNearbyEnabled(false);
    setCandidates([]);
    await refreshUserData();
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadiusKm(newRadius);
    if (profile && coords && nearbyEnabled) {
      await updateNearbyLocation(profile.uid, coords.lat, coords.lng, newRadius);
      await runNearbySearch(coords.lat, coords.lng, newRadius);
    }
  };

  const handleAction = async (
    candidate: NearbyCandidate,
    type: 'like' | 'superlike' | 'pass'
  ) => {
    if (!profile) return;
    setActingUid(candidate.profile.uid);
    try {
      const res = await recordInteraction({
        fromUid: profile.uid,
        fromName: profile.displayName,
        toUid: candidate.profile.uid,
        type,
      });
      setCandidates((prev) => prev.filter((c) => c.profile.uid !== candidate.profile.uid));
      if (selectedRadarCandidate?.profile.uid === candidate.profile.uid) {
        setSelectedRadarCandidate(null);
      }
      if (res.matched && res.matchId) {
        setMatchCelebration({
          matchId: res.matchId,
          peerName: candidate.profile.displayName,
          peerPhoto: candidate.profile.mainPhotoUrl,
        });
      }
    } finally {
      setActingUid(null);
    }
  };

  const expansionSuggestions = getNextRadiusSuggestions(radiusKm);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">{t('nearby.title')}</h1>
            {nearbyEnabled && coords && (
              <p className="text-xs text-slate-500 dark:text-[#A7AFBF] mt-1 tabular-nums">
                {t('nearby.resultsCount', { count: candidates.length, radius: radiusKm })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switch */}
            <div className="inline-flex rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-1">
              <button
                type="button"
                onClick={() => setMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'cards'
                    ? 'bg-[#FF5277] text-white'
                    : 'text-slate-600 dark:text-[#A7AFBF]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t('nearby.cardsMode')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('radar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'radar'
                    ? 'bg-[#FF5277] text-white'
                    : 'text-slate-600 dark:text-[#A7AFBF]'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>{t('nearby.radarMode')}</span>
              </button>
            </div>

            {nearbyEnabled ? (
              <>
                <button
                  type="button"
                  onClick={() => coords && runNearbySearch(coords.lat, coords.lng, radiusKm)}
                  className="p-2.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#A7AFBF] hover:text-white"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handlePauseNearby}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-[#202737] text-xs font-medium whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>{t('nearby.disableBtn')}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => requestAndEnableNearby(radiusKm)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF5277] text-white text-xs font-semibold hover:bg-[#FF5277]/90 whitespace-nowrap"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{t('nearby.enableBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Radius Control */}
        <div className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-[#A7AFBF]">
              {t('nearby.radiusLabel')}: <strong className="text-slate-900 dark:text-white tabular-nums">{radiusKm} km</strong>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => handleRadiusChange(km)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                    radiusKm === km
                      ? 'bg-[#FF5277] text-white'
                      : 'bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF]'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={radiusKm}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            aria-label={t('nearby.radiusLabel')}
            className="w-full accent-[#FF5277]"
          />
        </div>

        {permissionError && (
          <div role="alert" className="p-4 rounded-2xl bg-[#F2B749]/15 border border-[#F2B749]/30 text-sm text-[#F2B749] flex flex-wrap items-center justify-between gap-3">
            <span>{permissionError}</span>
            <Link to="/discover" className="font-semibold underline">
              {t('nav.discover')}
            </Link>
          </div>
        )}

        {/* Opt-in Prompt when Paused */}
        {!nearbyEnabled ? (
          <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-8 text-center max-w-xl mx-auto space-y-5">
            <img
              src={compassEmptyImg}
              alt="Nearby Compass"
              className="w-56 h-40 object-cover rounded-2xl mx-auto"
            />
            <h2 className="font-display text-xl font-bold">{t('nearby.enablePromptTitle')}</h2>
            <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
              {t('nearby.enablePromptDesc')}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => requestAndEnableNearby(radiusKm)}
                className="px-6 py-3 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90"
              >
                {t('nearby.enableBtn')}
              </button>
              <Link
                to="/discover"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 dark:bg-[#202737] text-sm font-medium"
              >
                <Compass className="w-4 h-4" />
                <span>{t('nav.discover')}</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Smart Radius Expansion Suggestion (never expands automatically) */}
            {!loading && candidates.length < 3 && expansionSuggestions.length > 0 && (
              <div className="rounded-2xl bg-[#9B7BFF]/10 border border-[#9B7BFF]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-slate-800 dark:text-white">
                  {t('nearby.expandPrompt')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {expansionSuggestions.map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => handleRadiusChange(km)}
                      className="px-3 py-1.5 rounded-lg bg-[#9B7BFF] text-white text-xs font-semibold hover:bg-[#9B7BFF]/90 tabular-nums whitespace-nowrap"
                    >
                      {t('nearby.expandBtn', { km })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && candidates.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-8 text-center max-w-xl mx-auto space-y-4">
                <img
                  src={compassEmptyImg}
                  alt="Empty Nearby Radar"
                  className="w-52 h-36 object-cover rounded-2xl mx-auto"
                />
                <h2 className="font-display text-xl font-bold">{t('nearby.emptyTitle')}</h2>
                <p className="text-sm text-slate-600 dark:text-[#A7AFBF]">{t('nearby.emptyDesc')}</p>
                <Link
                  to="/discover"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold"
                >
                  <Compass className="w-4 h-4" />
                  <span>{t('nav.discover')}</span>
                </Link>
              </div>
            ) : mode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map((item) => (
                  <ProfileCard
                    key={item.profile.uid}
                    profile={item.profile}
                    distanceKm={item.distanceKm}
                    compatibility={item.compatibility}
                    actionDisabled={actingUid === item.profile.uid}
                    onPass={() => handleAction(item, 'pass')}
                    onSuperLike={() => handleAction(item, 'superlike')}
                    onLike={() => handleAction(item, 'like')}
                  />
                ))}
              </div>
            ) : (
              /* Radar Visualization Mode */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 rounded-3xl bg-[#101420] border border-white/10 p-6 flex flex-col items-center space-y-4">
                  <div className="relative w-full max-w-[420px] aspect-square rounded-full border border-white/10 bg-[#0D1018] overflow-hidden">
                    {/* Concentric Distance Rings */}
                    <div className="absolute inset-[15%] rounded-full border border-white/10 pointer-events-none" />
                    <div className="absolute inset-[32%] rounded-full border border-white/10 pointer-events-none" />
                    <div className="absolute inset-[48%] rounded-full border border-white/15 pointer-events-none" />

                    {/* Radar Sweep */}
                    <div
                      className="absolute inset-0 rounded-full animate-radar-sweep pointer-events-none"
                      style={{
                        background:
                          'conic-gradient(from 0deg, rgba(255,82,119,0.22) 0deg, rgba(255,82,119,0.02) 55deg, transparent 85deg)',
                      }}
                    />

                    {/* Center self avatar */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-[#FF5277] bg-[#171C28] overflow-hidden flex items-center justify-center z-10">
                      {profile?.mainPhotoUrl ? (
                        <img
                          src={profile.mainPhotoUrl}
                          alt={profile.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>

                    {/* Real Nearby Candidates positioned deterministically */}
                    {candidates.map((cand) => {
                      const pos = deterministicRadarPosition(
                        cand.profile.uid,
                        cand.distanceKm,
                        radiusKm
                      );
                      const isSelected = selectedRadarCandidate?.profile.uid === cand.profile.uid;
                      return (
                        <button
                          key={cand.profile.uid}
                          type="button"
                          onClick={() => setSelectedRadarCandidate(cand)}
                          style={{ left: `${pos.xPercent}%`, top: `${pos.yPercent}%` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 z-20 ${
                            isSelected ? 'border-[#35C98A] scale-110' : 'border-[#9B7BFF]'
                          }`}
                          aria-label={`${cand.profile.displayName} ${formatApproxDistance(cand.distanceKm)}`}
                        >
                          {cand.profile.mainPhotoUrl ? (
                            <img
                              src={cand.profile.mainPhotoUrl}
                              alt={cand.profile.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#202737] flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-[#A7AFBF] flex items-center gap-1.5 text-center">
                    <Shield className="w-3.5 h-3.5 text-[#35C98A] shrink-0" />
                    <span>{t('nearby.radarDisclaimer')}</span>
                  </p>
                </div>

                {/* Selected Radar Candidate Preview */}
                <div>
                  {selectedRadarCandidate ? (
                    <ProfileCard
                      profile={selectedRadarCandidate.profile}
                      distanceKm={selectedRadarCandidate.distanceKm}
                      compatibility={selectedRadarCandidate.compatibility}
                      actionDisabled={actingUid === selectedRadarCandidate.profile.uid}
                      onPass={() => handleAction(selectedRadarCandidate, 'pass')}
                      onSuperLike={() => handleAction(selectedRadarCandidate, 'superlike')}
                      onLike={() => handleAction(selectedRadarCandidate, 'like')}
                    />
                  ) : (
                    <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 text-center text-sm text-slate-500 dark:text-[#A7AFBF]">
                      {candidates.length > 0
                        ? t('nearby.viewProfile')
                        : t('nearby.emptyTitle')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};
