import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Camera,
  ChevronRight,
  Crown,
  Edit3,
  Globe,
  LogOut,
  MapPin,
  Settings,
  Share2,
  Shield,
  Sliders,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import { getUserPhotos, requestSelfieVerification } from '../../services/profileService';
import { calculateProfileCompletion } from '../../utils/validation';

export const ProfileHubPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, account, profile, logout, refreshUserData } = useApp();
  const [photoCount, setPhotoCount] = useState(0);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    void getUserPhotos(firebaseUser.uid, firebaseUser.uid)
      .then((list) => setPhotoCount(list.length))
      .catch(() => {});
  }, [firebaseUser]);

  const completion = calculateProfileCompletion(profile, photoCount);

  const handleRequestVerification = async () => {
    if (!firebaseUser) return;
    setVerifying(true);
    try {
      await requestSelfieVerification(firebaseUser.uid);
      await refreshUserData();
    } finally {
      setVerifying(false);
    }
  };

  const links = [
    { to: '/profile/edit', label: t('profile.editProfile'), icon: Edit3 },
    { to: '/profile/photos', label: t('profile.photoGallery'), icon: Camera },
    { to: '/profile/contacts', label: t('profile.myContacts'), icon: Share2 },
    { to: '/profile/privacy', label: t('profile.contactPrivacy'), icon: Shield },
    { to: '/profile/location', label: t('profile.locationSettings'), icon: MapPin },
    { to: '/profile/preferences', label: t('profile.datingPreferences'), icon: Sliders },
    { to: '/profile/language', label: t('profile.languageSettings'), icon: Globe },
    { to: '/profile/settings', label: t('profile.accountSettings'), icon: Settings },
    { to: '/subscription', label: t('profile.subscriptionBilling'), icon: Crown },
  ];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Card */}
        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[#202737] overflow-hidden flex items-center justify-center shrink-0">
              {profile?.mainPhotoUrl ? (
                <img
                  src={profile.mainPhotoUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-[#A7AFBF]" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold">
                  {profile?.displayName || t('profile.myProfile')}
                </h1>
                {profile?.verificationStatus === 'verified' && (
                  <BadgeCheck className="w-5 h-5 text-[#35C98A]" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                {profile?.city}, {profile?.country} ·{' '}
                {account?.membershipTier === 'vip' ? 'VIP' : t('subscription.freeName')}
              </p>
              {firebaseUser && (
                <Link
                  to={`/profile/${firebaseUser.uid}`}
                  className="inline-block text-xs font-medium text-[#FF5277] hover:underline"
                >
                  {t('nearby.viewProfile')}
                </Link>
              )}
            </div>
          </div>

          <div className="min-w-[200px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-[#A7AFBF]">{t('profile.completion')}</span>
              <span className="font-bold tabular-nums">{completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-[#202737] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF5277] to-[#35C98A]"
                style={{ width: `${completion}%` }}
              />
            </div>

            {account?.selfieVerificationStatus === 'none' && (
              <button
                type="button"
                disabled={verifying}
                onClick={handleRequestVerification}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-[#9B7BFF]/15 text-[#9B7BFF] text-xs font-semibold hover:bg-[#9B7BFF]/25"
              >
                {t('profile.requestSelfieVerify')}
              </button>
            )}
            {account?.selfieVerificationStatus === 'pending' && (
              <p className="text-[11px] text-[#F2B749]">{t('profile.pendingVerification')}</p>
            )}
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="p-4 rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 hover:border-[#FF5277]/40 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-[#FF5277]" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A7AFBF] rtl:rotate-180" />
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full py-3 rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-[#F05265] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#F05265]/10"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('auth.logout')}</span>
        </button>
      </div>
    </AppShell>
  );
};
