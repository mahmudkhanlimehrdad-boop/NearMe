import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Globe,
  Instagram,
  Mail,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContactInformation, ContactMethod, VisibilityLevel } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import {
  deleteContactInformation,
  getOwnContactInformation,
  updateContactInformation,
  updateContactPrivacy,
} from '../../services/contactService';
import { CONTACT_METHODS, sanitizeAndValidateContact } from '../../utils/validation';

const METHOD_META: Record<
  ContactMethod,
  { icon: React.ComponentType<{ className?: string }>; inputType: string }
> = {
  instagram: { icon: Instagram, inputType: 'text' },
  telegram: { icon: Send, inputType: 'text' },
  whatsapp: { icon: MessageSquare, inputType: 'text' },
  website: { icon: Globe, inputType: 'url' },
  email: { icon: Mail, inputType: 'email' },
  mobile: { icon: Phone, inputType: 'tel' },
};

export const ContactsManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser } = useApp();

  const [contactInfo, setContactInfo] = useState<ContactInformation | null>(null);
  const [drafts, setDrafts] = useState<Record<ContactMethod, string>>({
    instagram: '',
    telegram: '',
    whatsapp: '',
    website: '',
    email: '',
    mobile: '',
  });
  const [errors, setErrors] = useState<Partial<Record<ContactMethod, string>>>({});
  const [savedMethod, setSavedMethod] = useState<ContactMethod | null>(null);
  const [busyMethod, setBusyMethod] = useState<ContactMethod | null>(null);

  const loadContacts = useCallback(async () => {
    if (!firebaseUser) return;
    const info = await getOwnContactInformation(firebaseUser.uid);
    setContactInfo(info);
    setDrafts({
      instagram: info.instagram?.value || '',
      telegram: info.telegram?.value || '',
      whatsapp: info.whatsapp?.value || '',
      website: info.website?.value || '',
      email: info.email?.value || '',
      mobile: info.mobile?.value || '',
    });
  }, [firebaseUser]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleSaveField = async (method: ContactMethod) => {
    if (!firebaseUser || !contactInfo) return;
    const raw = drafts[method] || '';
    const check = sanitizeAndValidateContact(method, raw);
    if (!check.valid) {
      setErrors((prev) => ({
        ...prev,
        [method]: t(check.errorKey || 'errors.generic'),
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, [method]: undefined }));
    setBusyMethod(method);
    try {
      const currentField = contactInfo[method];
      const defaultVis: VisibilityLevel =
        method === 'email' || method === 'mobile'
          ? currentField?.visibility || 'private'
          : currentField?.visibility || 'matches';

      const updated = await updateContactInformation(
        firebaseUser.uid,
        method,
        raw,
        defaultVis,
        true
      );
      setContactInfo(updated);
      setDrafts((prev) => ({ ...prev, [method]: updated[method].value }));
      setSavedMethod(method);
      setTimeout(() => setSavedMethod((cur) => (cur === method ? null : cur)), 2000);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [method]: err instanceof Error ? t(err.message, { defaultValue: err.message }) : t('errors.generic'),
      }));
    } finally {
      setBusyMethod(null);
    }
  };

  const handleVisibilityChange = async (method: ContactMethod, visibility: VisibilityLevel) => {
    if (!firebaseUser || !contactInfo) return;
    setBusyMethod(method);
    try {
      const updated = await updateContactPrivacy(firebaseUser.uid, method, visibility);
      setContactInfo(updated);
    } finally {
      setBusyMethod(null);
    }
  };

  const handleToggleEnabled = async (method: ContactMethod, nextEnabled: boolean) => {
    if (!firebaseUser || !contactInfo) return;
    setBusyMethod(method);
    try {
      const updated = await updateContactPrivacy(
        firebaseUser.uid,
        method,
        contactInfo[method].visibility,
        nextEnabled
      );
      setContactInfo(updated);
    } finally {
      setBusyMethod(null);
    }
  };

  const handleDeleteField = async (method: ContactMethod) => {
    if (!firebaseUser) return;
    setBusyMethod(method);
    setErrors((prev) => ({ ...prev, [method]: undefined }));
    try {
      const updated = await deleteContactInformation(firebaseUser.uid, method);
      setContactInfo(updated);
      setDrafts((prev) => ({ ...prev, [method]: '' }));
    } finally {
      setBusyMethod(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            {t('contacts.sectionTitle')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#A7AFBF] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#35C98A] shrink-0 mt-0.5" />
            <span>{t('contacts.sectionDesc')}</span>
          </p>
        </div>

        <div className="space-y-4">
          {CONTACT_METHODS.map((method) => {
            const meta = METHOD_META[method];
            const Icon = meta.icon;
            const field = contactInfo?.[method];
            const hasSavedValue = Boolean(field?.value);
            const visibility = field?.visibility || 'private';
            const enabled = Boolean(field?.enabled);
            const err = errors[method];
            const busy = busyMethod === method;

            return (
              <div
                key={method}
                data-testid={`contact-row-${method}`}
                className="rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FF5277]/15 text-[#FF5277] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm">{t(`contacts.${method}`)}</h2>
                      <p className="text-[11px] text-slate-500 dark:text-[#A7AFBF]">
                        {enabled ? t('contacts.enabled') : t('contacts.disabled')} ·{' '}
                        {t(
                          visibility === 'public'
                            ? 'contacts.visibilityPublic'
                            : visibility === 'matches'
                              ? 'contacts.visibilityMatches'
                              : 'contacts.visibilityPrivate'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      aria-label={`${t(`contacts.${method}`)} ${t('contacts.visibilityLabel')}`}
                      value={visibility}
                      disabled={busy}
                      onChange={(e) => handleVisibilityChange(method, e.target.value as VisibilityLevel)}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-xs font-medium"
                    >
                      <option value="public">{t('contacts.visibilityPublic')}</option>
                      <option value="matches">{t('contacts.visibilityMatches')}</option>
                      <option value="private">{t('contacts.visibilityPrivate')}</option>
                    </select>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      disabled={busy || !hasSavedValue}
                      onClick={() => handleToggleEnabled(method, !enabled)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 ${
                        enabled
                          ? 'bg-[#35C98A]/20 text-[#35C98A]'
                          : 'bg-slate-100 dark:bg-[#202737] text-slate-500 dark:text-[#A7AFBF]'
                      }`}
                    >
                      {enabled ? t('contacts.enabled') : t('contacts.disabled')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type={meta.inputType}
                    value={drafts[method]}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [method]: e.target.value }))}
                    placeholder={t(`contacts.placeholders.${method}`)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5277]"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveField(method)}
                      className="px-4 py-2.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold hover:bg-[#FF5277]/90 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {savedMethod === method ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('contacts.saved')}</span>
                        </>
                      ) : (
                        <span>{hasSavedValue ? t('contacts.save') : t('contacts.add')}</span>
                      )}
                    </button>

                    {hasSavedValue && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteField(method)}
                        aria-label={`${t('contacts.delete')} ${t(`contacts.${method}`)}`}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] text-[#F05265] hover:bg-[#F05265]/15"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {err && <p className="text-xs text-[#F05265]">{err}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
};
