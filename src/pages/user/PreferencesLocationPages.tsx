import React, { useEffect, useState } from 'react';
import { MapPin, Pause, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PreferredGender } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { updateUserPreferences, updateUserProfile } from '../../services/profileService';
import { disableNearbyLocation, updateNearbyLocation } from '../../services/discoveryService';
import { INTEREST_OPTIONS, SUPPORTED_PROFILE_LANGUAGES } from '../../utils/validation';

export const PreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, preferences, refreshUserData } = useApp();

  const [preferredGender, setPreferredGender] = useState<PreferredGender>('everyone');
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(45);
  const [preferredCountry, setPreferredCountry] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>([]);
  const [preferredInterests, setPreferredInterests] = useState<string[]>([]);
  const [searchRadiusKm, setSearchRadiusKm] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (preferences) {
      setPreferredGender(preferences.preferredGender || 'everyone');
      setMinAge(preferences.minimumAge || 18);
      setMaxAge(preferences.maximumAge || 45);
      setPreferredCountry(preferences.preferredCountry || '');
      setPreferredCity(preferences.preferredCity || '');
      setPreferredLanguages(preferences.preferredLanguages || []);
      setPreferredInterests(preferences.preferredInterests || []);
      setSearchRadiusKm(preferences.searchRadiusKm || 10);
    }
  }, [preferences]);

  const toggleArr = (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateUserProfile(firebaseUser.uid, { preferredGender });
      await updateUserPreferences(firebaseUser.uid, {
        preferredGender,
        minimumAge: Math.max(18, minAge),
        maximumAge: Math.max(Math.max(18, minAge), maxAge),
        preferredCountry,
        preferredCity,
        preferredLanguages,
        preferredInterests,
        searchRadiusKm,
      });
      await refreshUserData();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <form
          onSubmit={handleSave}
          className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold">{t('profile.datingPreferences')}</h1>
            {saved && <span className="text-xs font-semibold text-[#35C98A]">{t('contacts.saved')}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('common.preferredGender')}
              </label>
              <select
                value={preferredGender}
                onChange={(e) => setPreferredGender(e.target.value as PreferredGender)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
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
              <div className="flex gap-2">
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={minAge}
                  onChange={(e) => setMinAge(Math.max(18, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                />
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Math.max(18, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('common.country')}
              </label>
              <input
                type="text"
                value={preferredCountry}
                onChange={(e) => setPreferredCountry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('common.city')}
              </label>
              <input
                type="text"
                value={preferredCity}
                onChange={(e) => setPreferredCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
              {t('nearby.radiusLabel')}: <span className="tabular-nums">{searchRadiusKm} km</span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={searchRadiusKm}
              onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
              className="w-full accent-[#FF5277]"
            />
          </div>

          <div>
            <p className="text-xs font-medium mb-2 text-slate-600 dark:text-[#A7AFBF]">
              {t('common.interests')}
            </p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleArr(preferredInterests, setPreferredInterests, opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    preferredInterests.includes(opt)
                      ? 'bg-[#FF5277] text-white'
                      : 'bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF]'
                  }`}
                >
                  {t(`common.interestLabels.${opt}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2 text-slate-600 dark:text-[#A7AFBF]">
              {t('common.languages')}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_PROFILE_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleArr(preferredLanguages, setPreferredLanguages, lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    preferredLanguages.includes(lang)
                      ? 'bg-[#9B7BFF] text-white'
                      : 'bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF]'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

export const LocationSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, preferences, refreshUserData } = useApp();

  const [radiusKm, setRadiusKm] = useState(preferences?.searchRadiusKm || 10);
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const handleEnableOrUpdateGps = () => {
    if (!firebaseUser || !('geolocation' in navigator)) {
      setStatusMsg(t('nearby.permissionDenied'));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await updateNearbyLocation(
          firebaseUser.uid,
          pos.coords.latitude,
          pos.coords.longitude,
          radiusKm
        );
        await refreshUserData();
        setStatusMsg(`${res.geohash} (${res.approxLat}, ${res.approxLng})`);
        setBusy(false);
      },
      () => {
        setStatusMsg(t('nearby.permissionDenied'));
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handlePause = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      await disableNearbyLocation(firebaseUser.uid);
      await refreshUserData();
      setStatusMsg(t('nearby.enablePromptTitle'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold">{t('profile.locationSettings')}</h1>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#202737] text-xs text-slate-600 dark:text-[#A7AFBF] flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-[#35C98A] shrink-0 mt-0.5" />
            <span>{t('nearby.enablePromptDesc')}</span>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
              {t('nearby.radiusLabel')}: <span className="tabular-nums">{radiusKm} km</span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-[#FF5277]"
            />
          </div>

          {statusMsg && (
            <p className="text-xs font-medium text-[#35C98A] tabular-nums">{statusMsg}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleEnableOrUpdateGps}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50"
            >
              <MapPin className="w-4 h-4" />
              <span>{t('nearby.enableBtn')}</span>
            </button>

            {preferences?.nearbyEnabled && (
              <button
                type="button"
                disabled={busy}
                onClick={handlePause}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-xs font-semibold"
              >
                <Pause className="w-4 h-4" />
                <span>{t('nearby.disableBtn')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
