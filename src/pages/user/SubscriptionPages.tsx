import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Crown, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PaymentRecord } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import {
  BackendConfigStatus,
  createCheckoutSession,
  getBackendConfigStatus,
  getPaymentHistory,
} from '../../services/subscriptionService';
import { formatLocalizedCurrency } from '../../utils/localization';

export const SubscriptionPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, account, language } = useApp();

  const [configStatus, setConfigStatus] = useState<BackendConfigStatus | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  useEffect(() => {
    void getBackendConfigStatus().then(setConfigStatus);
  }, []);

  const plans: Array<{ id: 'monthly' | 'quarterly' | 'annual'; label: string; usd: number; discount?: number }> = [
    { id: 'monthly', label: t('subscription.monthly'), usd: 14.99 },
    { id: 'quarterly', label: t('subscription.quarterly'), usd: 11.99, discount: 20 },
    { id: 'annual', label: t('subscription.annual'), usd: 8.99, discount: 40 },
  ];

  const freeFeatures = t('subscription.featuresFree', { returnObjects: true }) as string[];
  const vipFeatures = t('subscription.featuresVip', { returnObjects: true }) as string[];

  const handleCheckout = async (plan: 'monthly' | 'quarterly' | 'annual') => {
    if (!firebaseUser) return;
    setCheckoutError('');
    setBusyPlan(plan);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await createCheckoutSession(token, plan);
      if (res.ok && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
      } else {
        setCheckoutError(res.error || t('subscription.configMissingDesc'));
      }
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
              <Crown className="w-7 h-7 text-amber-400" />
              <span>{t('subscription.title')}</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#A7AFBF] mt-1">
              {t('subscription.subtitle')}
            </p>
          </div>
          <Link
            to="/subscription/history"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs font-medium"
          >
            <Receipt className="w-4 h-4" />
            <span>{t('profile.paymentHistory')}</span>
          </Link>
        </div>

        {/* Real Credential Status Notice */}
        {configStatus && !configStatus.paymentConfigured && (
          <div className="rounded-2xl bg-[#F2B749]/10 border border-[#F2B749]/30 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F2B749] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#F2B749]">
                {t('subscription.configMissingTitle')}
              </p>
              <p className="text-xs text-slate-700 dark:text-[#A7AFBF]">
                {t('subscription.configMissingDesc')} ({configStatus.missingCredentials.join(', ')})
              </p>
            </div>
          </div>
        )}

        {checkoutError && (
          <div className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]">
            {checkoutError}
          </div>
        )}

        {/* Free vs VIP Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t('subscription.freeName')}</h2>
              {account?.membershipTier !== 'vip' && (
                <span className="text-xs font-semibold text-[#35C98A]">
                  {t('subscription.currentTier')}
                </span>
              )}
            </div>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-[#A7AFBF]">
              {Array.isArray(freeFeatures) &&
                freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#35C98A] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-[#FF5277]/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#FF5277]">
                {t('subscription.vipName')}
              </h2>
              {account?.membershipTier === 'vip' && (
                <span className="text-xs font-semibold text-[#35C98A]">
                  {t('subscription.currentTier')}
                </span>
              )}
            </div>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-[#A7AFBF]">
              {Array.isArray(vipFeatures) &&
                vipFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#FF5277] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg">{p.label}</h3>
                  {p.discount && (
                    <span className="text-xs font-semibold text-[#35C98A]">
                      {t('subscription.savePercent', { pct: p.discount })}
                    </span>
                  )}
                </div>
                <p className="font-display text-2xl font-bold mt-2 tabular-nums">
                  {formatLocalizedCurrency(p.usd, language)}{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-[#A7AFBF]">
                    {t('subscription.perMonth')}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={busyPlan === p.id || !configStatus?.paymentConfigured}
                onClick={() => handleCheckout(p.id)}
                className="w-full py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold hover:bg-[#FF5277]/90 disabled:opacity-40"
              >
                {busyPlan === p.id ? t('common.loading') : t('subscription.selectPlan')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export const PaymentHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, language } = useApp();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    void getPaymentHistory(firebaseUser.uid)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="font-display text-2xl font-bold">{t('subscription.historyTitle')}</h1>

        <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">{t('common.loading')}</div>
          ) : records.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-[#A7AFBF]">
              {t('subscription.noHistory')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {records.map((rec) => (
                <div key={rec.paymentId} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold capitalize">{rec.plan}</p>
                    <p className="text-xs text-slate-500 dark:text-[#A7AFBF]">{rec.paymentId}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold tabular-nums">
                      {formatLocalizedCurrency(rec.amountCents / 100, language)}
                    </p>
                    <p className="text-xs uppercase text-[#35C98A]">{rec.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
