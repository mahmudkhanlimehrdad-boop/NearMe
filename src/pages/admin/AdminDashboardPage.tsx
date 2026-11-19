import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle,
  CreditCard,
  FileText,
  Flag,
  Image as ImageIcon,
  RotateCcw,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode, ProfilePhoto } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import {
  AdminDashboardData,
  adminModeratePhoto,
  adminResolveReport,
  adminSetAccountStatus,
  adminUpdatePlatformSettings,
  adminVerifyProfile,
  fetchAdminDashboardData,
  fetchPendingModerationPhotos,
} from '../../services/adminService';
import { SUPPORTED_LANGUAGES } from '../../utils/localization';

type AdminTab =
  | 'overview'
  | 'users'
  | 'moderation'
  | 'photos'
  | 'subscriptions'
  | 'analytics'
  | 'settings'
  | 'audit';

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, isAdmin } = useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<ProfilePhoto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [maxRadiusKm, setMaxRadiusKm] = useState(50);
  const [freeLikes, setFreeLikes] = useState(25);
  const [vipLikes, setVipLikes] = useState(500);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [enabledLangs, setEnabledLangs] = useState<LanguageCode[]>([
    'fa',
    'en',
    'tr',
    'ar',
    'zh-CN',
    'zh-TW',
  ]);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const loadAll = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [dash, phList] = await Promise.all([
        fetchAdminDashboardData(),
        fetchPendingModerationPhotos(),
      ]);
      setData(dash);
      setPendingPhotos(phList);
      if (dash.settings) {
        setMaxRadiusKm(dash.settings.maxRadiusKm);
        setFreeLikes(dash.settings.defaultDailyLikesFree);
        setVipLikes(dash.settings.defaultDailyLikesVip);
        setMaintenanceMode(dash.settings.maintenanceMode);
        setEnabledLangs(dash.settings.enabledLanguages);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!isAdmin || !firebaseUser) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto p-10 text-center space-y-3">
          <Shield className="w-10 h-10 text-[#F05265] mx-auto" />
          <p className="text-sm text-slate-600 dark:text-[#A7AFBF]">{t('admin.unauthorized')}</p>
        </div>
      </AppShell>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: t('admin.tabs.overview'), icon: Activity },
    { id: 'users', label: t('admin.tabs.users'), icon: Users },
    { id: 'moderation', label: t('admin.tabs.moderation'), icon: Flag },
    { id: 'photos', label: t('admin.tabs.photos'), icon: ImageIcon },
    { id: 'subscriptions', label: t('admin.tabs.subscriptions'), icon: CreditCard },
    { id: 'analytics', label: t('admin.tabs.analytics'), icon: Activity },
    { id: 'settings', label: t('admin.tabs.settings'), icon: Settings },
    { id: 'audit', label: t('admin.tabs.audit'), icon: FileText },
  ];

  const profiles = data?.profiles || [];
  const users = data?.users || [];
  const matches = data?.matches || [];
  const reports = data?.reports || [];
  const filteredProfiles = profiles.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      p.uid.toLowerCase().includes(q)
    );
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminUpdatePlatformSettings(firebaseUser.uid, {
      enabledLanguages: enabledLangs,
      maxRadiusKm,
      defaultDailyLikesFree: freeLikes,
      defaultDailyLikesVip: vipLikes,
      maintenanceMode,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
    await loadAll();
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{t('admin.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-[#A7AFBF] mt-1">{t('admin.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#9B7BFF] text-white'
                    : 'bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#A7AFBF]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {loading || !data ? (
          <div className="h-64 rounded-3xl bg-white dark:bg-[#171C28] animate-pulse" />
        ) : (
          <>
            {/* 1. Overview */}
            {tab === 'overview' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: t('admin.metrics.totalUsers'), value: users.length },
                  {
                    label: t('admin.metrics.activeUsers'),
                    value: profiles.filter((p) => p.accountStatus === 'active').length,
                  },
                  {
                    label: t('admin.metrics.onlineUsers'),
                    value: profiles.filter((p) => p.isOnline).length,
                  },
                  {
                    label: t('admin.metrics.verifiedUsers'),
                    value: profiles.filter((p) => p.verificationStatus === 'verified').length,
                  },
                  {
                    label: t('admin.metrics.totalMatches'),
                    value: matches.filter((m) => m.status === 'active').length,
                  },
                  {
                    label: t('admin.metrics.vipUsers'),
                    value: users.filter((u) => u.membershipTier === 'vip').length,
                  },
                  {
                    label: t('admin.metrics.openReports'),
                    value: reports.filter((r) => r.status === 'open').length,
                  },
                  { label: t('admin.tabs.photos'), value: pendingPhotos.length },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-5"
                  >
                    <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">{stat.label}</p>
                    <p className="font-display text-3xl font-bold mt-1 tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Users Management */}
            {tab === 'users' && (
              <div className="space-y-4">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full max-w-md px-4 py-2.5 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-sm"
                />
                <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                  {filteredProfiles.map((p) => (
                    <div
                      key={p.uid}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-sm flex items-center gap-1.5">
                          <span>{p.displayName}</span>
                          {p.verificationStatus === 'verified' && (
                            <BadgeCheck className="w-4 h-4 text-[#35C98A]" />
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                          {p.city}, {p.country} · {p.accountStatus} · {p.uid}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {p.verificationStatus !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => adminVerifyProfile(firebaseUser.uid, p.uid).then(loadAll)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#35C98A]/15 text-[#35C98A] text-xs font-semibold"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{t('admin.actions.verify')}</span>
                          </button>
                        )}
                        {p.accountStatus === 'active' ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                adminSetAccountStatus(firebaseUser.uid, p.uid, 'suspended').then(
                                  loadAll
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#F2B749]/15 text-[#F2B749] text-xs font-semibold"
                            >
                              {t('admin.actions.suspend')}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                adminSetAccountStatus(firebaseUser.uid, p.uid, 'banned').then(loadAll)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F05265]/15 text-[#F05265] text-xs font-semibold"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>{t('admin.actions.ban')}</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              adminSetAccountStatus(firebaseUser.uid, p.uid, 'active').then(loadAll)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#9B7BFF]/15 text-[#9B7BFF] text-xs font-semibold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{t('admin.actions.restore')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Moderation / Reports */}
            {tab === 'moderation' && (
              <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                {reports.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">No reports filed.</p>
                ) : (
                  reports.map((rep) => (
                    <div
                      key={rep.reportId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {rep.reason} ({rep.targetType})
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">
                          Target: {rep.targetUid} · Status: {rep.status}
                        </p>
                        {rep.details && <p className="text-xs mt-1">{rep.details}</p>}
                      </div>
                      {rep.status === 'open' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              adminResolveReport(
                                firebaseUser.uid,
                                rep.reportId,
                                rep.targetUid,
                                'resolved',
                                'Action taken by admin'
                              ).then(loadAll)
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#35C98A] text-[#0D1018] text-xs font-semibold"
                          >
                            {t('admin.actions.resolveReport')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              adminResolveReport(
                                firebaseUser.uid,
                                rep.reportId,
                                rep.targetUid,
                                'dismissed',
                                'Dismissed'
                              ).then(loadAll)
                            }
                            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-[#202737] text-xs font-medium"
                          >
                            {t('admin.actions.dismissReport')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 4. Photo Moderation */}
            {tab === 'photos' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingPhotos.length === 0 ? (
                  <p className="col-span-full p-8 text-center text-sm text-slate-500 bg-white dark:bg-[#171C28] rounded-3xl">
                    No pending photos to moderate.
                  </p>
                ) : (
                  pendingPhotos.map((ph) => (
                    <div
                      key={ph.photoId}
                      className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden"
                    >
                      <img src={ph.thumbnailUrl || ph.url} alt="Moderation" className="w-full h-56 object-cover" />
                      <div className="p-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500 truncate">{ph.uid}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              adminModeratePhoto(firebaseUser.uid, ph.uid, ph.photoId, 'approved').then(
                                loadAll
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#35C98A] text-[#0D1018] text-xs font-semibold"
                          >
                            {t('admin.actions.approvePhoto')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              adminModeratePhoto(firebaseUser.uid, ph.uid, ph.photoId, 'rejected').then(
                                loadAll
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#F05265] text-white text-xs font-semibold"
                          >
                            {t('admin.actions.rejectPhoto')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 5. Subscriptions & Payments */}
            {tab === 'subscriptions' && (
              <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                {data.payments.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    {t('subscription.noHistory')}
                  </p>
                ) : (
                  data.payments.map((pay) => (
                    <div key={pay.paymentId} className="p-4 flex items-center justify-between text-xs">
                      <span>
                        {pay.uid} · {pay.plan}
                      </span>
                      <span className="font-bold tabular-nums">
                        {(pay.amountCents / 100).toFixed(2)} {pay.currency} ({pay.status})
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 6. Analytics */}
            {tab === 'analytics' && (
              <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-4">
                <h2 className="font-display text-lg font-bold">{t('admin.tabs.analytics')}</h2>
                <div className="space-y-3">
                  {[
                    {
                      label: t('admin.metrics.activeUsers'),
                      count: profiles.filter((p) => p.accountStatus === 'active').length,
                      total: Math.max(1, users.length),
                      color: 'bg-[#FF5277]',
                    },
                    {
                      label: t('admin.metrics.verifiedUsers'),
                      count: profiles.filter((p) => p.verificationStatus === 'verified').length,
                      total: Math.max(1, users.length),
                      color: 'bg-[#35C98A]',
                    },
                    {
                      label: t('admin.metrics.vipUsers'),
                      count: users.filter((u) => u.membershipTier === 'vip').length,
                      total: Math.max(1, users.length),
                      color: 'bg-[#9B7BFF]',
                    },
                  ].map((bar) => (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{bar.label}</span>
                        <span className="tabular-nums font-semibold">
                          {bar.count} / {users.length}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-[#202737] overflow-hidden">
                        <div
                          className={`h-full ${bar.color}`}
                          style={{ width: `${Math.round((bar.count / bar.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Platform Settings */}
            {tab === 'settings' && (
              <form
                onSubmit={handleSaveSettings}
                className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-5 max-w-2xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs mb-1 text-slate-500">Max Radius (km)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxRadiusKm}
                      onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-slate-500">Free Daily Likes</label>
                    <input
                      type="number"
                      min={1}
                      value={freeLikes}
                      onChange={(e) => setFreeLikes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-slate-500">VIP Daily Likes</label>
                    <input
                      type="number"
                      min={1}
                      value={vipLikes}
                      onChange={(e) => setVipLikes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs mb-2 text-slate-500">Enabled Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {SUPPORTED_LANGUAGES.map((l) => {
                      const active = enabledLangs.includes(l.code);
                      return (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() =>
                            setEnabledLangs((prev) =>
                              prev.includes(l.code)
                                ? prev.filter((c) => c !== l.code)
                                : [...prev, l.code]
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs ${
                            active
                              ? 'bg-[#FF5277] text-white'
                              : 'bg-slate-100 dark:bg-[#202737] text-slate-500'
                          }`}
                        >
                          {l.nativeName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="accent-[#FF5277]"
                  />
                  <span>Maintenance Mode</span>
                </label>

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold"
                  >
                    {t('admin.actions.saveSettings')}
                  </button>
                  {settingsSaved && <span className="text-xs text-[#35C98A]">{t('contacts.saved')}</span>}
                </div>
              </form>
            )}

            {/* 8. Audit Logs */}
            {tab === 'audit' && (
              <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                {data.auditLogs.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">No audit entries yet.</p>
                ) : (
                  data.auditLogs.map((log) => (
                    <div key={log.logId} className="p-4 flex items-center justify-between text-xs gap-4">
                      <div>
                        <p className="font-semibold">{log.action}</p>
                        <p className="text-slate-500 dark:text-[#A7AFBF]">{log.details}</p>
                      </div>
                      <span className="text-slate-400 shrink-0">{log.actorUid}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};
