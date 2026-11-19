import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronLeft, ChevronRight, MapPin, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Gender, PreferredGender, RelationshipGoal } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import {
  completeOnboarding,
  updateAccountSettings,
  updateUserPreferences,
  updateUserProfile,
  uploadProfilePhoto,
} from '../../services/profileService';
import { updateNearbyLocation } from '../../services/discoveryService';
import {
  INTEREST_OPTIONS,
  isAdult18Plus,
  SUPPORTED_PROFILE_LANGUAGES,
} from '../../utils/validation';
import { NearMeLogo } from '../../components/NearMeLogo';
import { LanguageSelector } from '../../components/LanguageSelector';

export const OnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { firebaseUser, profile, preferences, settings, refreshUserData } = useApp();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 2: 18+ confirmation
  const [birthDate, setBirthDate] = useState(profile?.birthDate || '1998-01-01');
  const [ageConfirmed, setAgeConfirmed] = useState(true);

  // Step 3: Personal Info
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [gender, setGender] = useState<Gender>(profile?.gender || 'other');
  const [country, setCountry] = useState(profile?.country || '');
  const [city, setCity] = useState(profile?.city || '');
  const [occupation, setOccupation] = useState(profile?.occupation || '');

  // Step 4: Bio, Interests, Languages, Main Photo
  const [biography, setBiography] = useState(profile?.biography || '');
  const [interests, setInterests] = useState<string[]>(profile?.interests || ['travel', 'music']);
  const [languages, setLanguages] = useState<string[]>(profile?.languages || ['English']);
  const [relationshipGoals, setRelationshipGoals] = useState<RelationshipGoal>(
    profile?.relationshipGoals || 'serious'
  );
  const [photoUploading, setPhotoUploading] = useState(false);
  const [mainPhotoPreview, setMainPhotoPreview] = useState(profile?.mainPhotoUrl || '');

  // Step 5: Preferences
  const [preferredGender, setPreferredGender] = useState<PreferredGender>(
    preferences?.preferredGender || 'everyone'
  );
  const [minAge, setMinAge] = useState(preferences?.minimumAge || 18);
  const [maxAge, setMaxAge] = useState(preferences?.maximumAge || 45);
  const [radiusKm, setRadiusKm] = useState(preferences?.searchRadiusKm || 10);

  // Step 6: Permissions
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [notifStatus, setNotifStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    if (profile) {
      setDisplayName((prev) => prev || profile.displayName);
      setBirthDate((prev) => prev || profile.birthDate || '1998-01-01');
      setGender(profile.gender || 'other');
      setCountry((prev) => prev || (profile.country === 'International' ? '' : profile.country));
      setCity((prev) => prev || (profile.city === 'Global' ? '' : profile.city));
      setBiography((prev) => prev || profile.biography || '');
      if (profile.mainPhotoUrl) setMainPhotoPreview(profile.mainPhotoUrl);
    }
  }, [profile]);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item].slice(0, 10)
    );
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang].slice(0, 8)
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setError('');
    setPhotoUploading(true);
    try {
      const uploaded = await uploadProfilePhoto({
        uid: firebaseUser.uid,
        file,
        visibility: 'public',
      });
      setMainPhotoPreview(uploaded.url);
      await refreshUserData();
    } catch (err) {
      setError(err instanceof Error ? t(err.message, { defaultValue: err.message }) : t('errors.generic'));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleEnableGps = () => {
    if (!firebaseUser || !('geolocation' in navigator)) {
      setGpsStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await updateNearbyLocation(firebaseUser.uid, pos.coords.latitude, pos.coords.longitude, radiusKm);
        setGpsStatus('granted');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleEnableNotifications = async () => {
    if (!firebaseUser || typeof Notification === 'undefined') {
      setNotifStatus('denied');
      return;
    }
    const res = await Notification.requestPermission();
    if (res === 'granted') {
      await updateAccountSettings(firebaseUser.uid, {
        notifications: {
          ...(settings?.notifications ?? {
            matches: true,
            messages: true,
            likes: true,
            verification: true,
            subscriptions: true,
            security: true,
            browserPush: true,
          }),
          browserPush: true,
        },
      });
      setNotifStatus('granted');
    } else {
      setNotifStatus('denied');
    }
  };

  const handleNext = async () => {
    setError('');
    if (!firebaseUser) return;

    if (step === 2) {
      if (!ageConfirmed || !isAdult18Plus(birthDate)) {
        setError(t('errors.under18'));
        return;
      }
    }

    if (step === 3) {
      if (!displayName.trim() || !country.trim() || !city.trim()) {
        setError(t('errors.required'));
        return;
      }
      setSaving(true);
      try {
        await updateUserProfile(firebaseUser.uid, {
          displayName: displayName.trim(),
          birthDate,
          gender,
          country: country.trim(),
          city: city.trim(),
          occupation: occupation.trim(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.generic'));
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    if (step === 4) {
      setSaving(true);
      try {
        await updateUserProfile(firebaseUser.uid, {
          biography: biography.trim(),
          interests,
          languages,
          relationshipGoals,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.generic'));
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    if (step === 5) {
      setSaving(true);
      try {
        await updateUserProfile(firebaseUser.uid, { preferredGender });
        await updateUserPreferences(firebaseUser.uid, {
          preferredGender,
          minimumAge: Math.max(18, minAge),
          maximumAge: Math.max(Math.max(18, minAge), maxAge),
          searchRadiusKm: radiusKm,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.generic'));
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    if (step < 6) {
      setStep((s) => s + 1);
    }
  };

  const handleFinish = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await completeOnboarding(firebaseUser.uid);
      await refreshUserData();
      navigate('/nearby');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
      <header className="h-16 px-6 max-w-4xl w-full mx-auto flex items-center justify-between">
        <NearMeLogo />
        <LanguageSelector compact />
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#A7AFBF]">
              <span>{t('onboarding.title')}</span>
              <span className="tabular-nums">{t('onboarding.stepLabel', { current: step, total: 6 })}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#202737] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF5277] to-[#9B7BFF] transition-all duration-300"
                style={{ width: `${(step / 6) * 100}%` }}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]">
              {error}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4 py-4">
              <h1 className="font-display text-2xl font-bold">{t('onboarding.step1Title')}</h1>
              <p className="text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                {t('onboarding.step1Desc')}
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#202737] text-xs text-slate-600 dark:text-[#A7AFBF] space-y-2">
                <p>{t('welcome.independentNotice')}</p>
                <p>{t('welcome.ageNotice')}</p>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">{t('onboarding.step2Title')}</h2>
              <p className="text-sm text-slate-600 dark:text-[#A7AFBF]">{t('onboarding.step2Desc')}</p>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                  {t('auth.birthDate')}
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                />
              </div>
              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-[#A7AFBF]">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#FF5277]"
                />
                <span>{t('auth.age18Confirm')}</span>
              </label>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">{t('onboarding.step3Title')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                    {t('auth.displayName')}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                    {t('common.gender')}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                  >
                    <option value="woman">{t('common.genders.woman')}</option>
                    <option value="man">{t('common.genders.man')}</option>
                    <option value="nonbinary">{t('common.genders.nonbinary')}</option>
                    <option value="other">{t('common.genders.other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                    {t('common.country')}
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                    {t('common.city')}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.occupation')}
                </label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                />
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">{t('onboarding.step4Title')}</h2>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
                  {mainPhotoPreview ? (
                    <img src={mainPhotoPreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#A7AFBF]" />
                  )}
                </div>
                <label className="px-4 py-2.5 rounded-xl bg-[#202737] text-white text-xs font-medium cursor-pointer hover:bg-[#2a3347]">
                  {photoUploading ? t('common.loading') : t('photos.uploadBtn')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={photoUploading}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.biography')}
                </label>
                <textarea
                  rows={3}
                  value={biography}
                  onChange={(e) => setBiography(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.relationshipGoals')}
                </label>
                <select
                  value={relationshipGoals}
                  onChange={(e) => setRelationshipGoals(e.target.value as RelationshipGoal)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
                >
                  <option value="serious">{t('common.goals.serious')}</option>
                  <option value="casual">{t('common.goals.casual')}</option>
                  <option value="friendship">{t('common.goals.friendship')}</option>
                  <option value="networking">{t('common.goals.networking')}</option>
                  <option value="undecided">{t('common.goals.undecided')}</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-medium mb-2 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.interests')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((opt) => {
                    const selected = interests.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleInterest(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-[#FF5277] text-white'
                            : 'bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF]'
                        }`}
                      >
                        {t(`common.interestLabels.${opt}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-2 text-slate-600 dark:text-[#A7AFBF]">
                  {t('common.languages')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_PROFILE_LANGUAGES.map((lang) => {
                    const selected = languages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-[#9B7BFF] text-white'
                            : 'bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF]'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">{t('onboarding.step5Title')}</h2>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                    {t('discover.minAge')}
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={minAge}
                    onChange={(e) => setMinAge(Math.max(18, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
                    {t('discover.maxAge')}
                  </label>
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
                <label className="block text-xs font-medium mb-1.5 text-slate-600 dark:text-[#A7AFBF]">
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
            </div>
          )}

          {/* Step 6 */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">{t('onboarding.step6Title')}</h2>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#202737] space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#FF5277]" />
                      {t('onboarding.enableGpsNow')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                      {t('nearby.enablePromptDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnableGps}
                    className="px-3.5 py-2 rounded-xl bg-[#FF5277] text-white text-xs font-semibold shrink-0"
                  >
                    {gpsStatus === 'granted' ? <Check className="w-4 h-4" /> : t('nearby.enableBtn')}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#202737] space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#9B7BFF]" />
                      {t('onboarding.enableNotificationsNow')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                      {t('notifications.pushDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="px-3.5 py-2 rounded-xl bg-[#9B7BFF] text-white text-xs font-semibold shrink-0"
                  >
                    {notifStatus === 'granted' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      t('notifications.enablePush')
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#A7AFBF]">
                <ShieldCheck className="w-4 h-4 text-[#35C98A]" />
                <span>{t('contacts.sectionDesc')}</span>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                <span>{t('onboarding.back')}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 6 ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50"
              >
                <span>{saving ? t('common.loading') : t('onboarding.next')}</span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#35C98A] text-[#0D1018] text-sm font-bold hover:bg-[#35C98A]/90 disabled:opacity-50"
              >
                <span>{saving ? t('common.loading') : t('onboarding.finish')}</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
