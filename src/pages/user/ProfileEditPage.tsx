import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Gender, PreferredGender, RelationshipGoal } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { updateUserProfile } from '../../services/profileService';
import {
  HOBBY_OPTIONS,
  INTEREST_OPTIONS,
  SUPPORTED_PROFILE_LANGUAGES,
} from '../../utils/validation';

export const ProfileEditPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, profile, refreshUserData } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [preferredGender, setPreferredGender] = useState<PreferredGender>('everyone');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [biography, setBiography] = useState('');
  const [relationshipGoals, setRelationshipGoals] = useState<RelationshipGoal>('undecided');
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'hidden'>('public');
  const [interests, setInterests] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setGender(profile.gender || 'other');
      setPreferredGender(profile.preferredGender || 'everyone');
      setCountry(profile.country || '');
      setCity(profile.city || '');
      setOccupation(profile.occupation || '');
      setBiography(profile.biography || '');
      setRelationshipGoals(profile.relationshipGoals || 'undecided');
      setProfileVisibility(profile.profileVisibility || 'public');
      setInterests(profile.interests || []);
      setHobbies(profile.hobbies || []);
      setLanguages(profile.languages || []);
    }
  }, [profile]);

  const toggleItem = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item].slice(0, 12));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateUserProfile(firebaseUser.uid, {
        displayName,
        gender,
        preferredGender,
        country,
        city,
        occupation,
        biography,
        relationshipGoals,
        profileVisibility,
        interests,
        hobbies,
        languages,
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
            <h1 className="font-display text-2xl font-bold">{t('profile.editProfile')}</h1>
            {saved && <span className="text-xs font-semibold text-[#35C98A]">{t('contacts.saved')}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('auth.displayName')}
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('common.occupation')}
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('common.country')}
              </label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
                {t('common.city')}
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
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
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
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
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-[#A7AFBF]">
              {t('common.biography')}
            </label>
            <textarea
              rows={4}
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm"
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
                  onClick={() => toggleItem(interests, setInterests, opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    interests.includes(opt)
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
              {t('common.hobbies')}
            </p>
            <div className="flex flex-wrap gap-2">
              {HOBBY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleItem(hobbies, setHobbies, opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    hobbies.includes(opt)
                      ? 'bg-[#9B7BFF] text-white'
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
                  onClick={() => toggleItem(languages, setLanguages, lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    languages.includes(lang)
                      ? 'bg-[#35C98A] text-[#0D1018]'
                      : 'bg-slate-100 dark:bg-[#202737] text-slate-600 dark:text-[#A7AFBF]'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-white/10">
            <select
              value={profileVisibility}
              onChange={(e) => setProfileVisibility(e.target.value as 'public' | 'hidden')}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-xs"
            >
              <option value="public">{t('profile.profilePublic')}</option>
              <option value="hidden">{t('profile.profileHidden')}</option>
            </select>

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
