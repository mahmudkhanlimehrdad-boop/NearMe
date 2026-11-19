import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NearMeLogo } from '../../components/NearMeLogo';
import { LanguageSelector } from '../../components/LanguageSelector';

const PublicLegalShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#0D1018] text-slate-900 dark:text-white flex flex-col">
    <header className="h-16 px-6 max-w-5xl w-full mx-auto flex items-center justify-between border-b border-slate-200 dark:border-white/10">
      <Link to="/">
        <NearMeLogo />
      </Link>
      <LanguageSelector compact />
    </header>
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-4 text-sm text-slate-700 dark:text-[#A7AFBF] leading-relaxed">
        {children}
      </div>
    </main>
  </div>
);

export const TermsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <PublicLegalShell title={t('legal.termsTitle')}>
      <p>NearMe is strictly limited to consenting adults aged 18 and older. Account registration requires age confirmation and date-of-birth verification enforced in security rules.</p>
      <p>Members are responsible for respectful conduct, authentic photography, and honoring privacy boundaries. Harassment, impersonation, spam, or unlawful content results in immediate suspension or permanent ban.</p>
      <p>Paid VIP memberships require verified payment provider confirmation and follow transparent renewal and cancellation policies.</p>
    </PublicLegalShell>
  );
};

export const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <PublicLegalShell title={t('legal.privacyTitle')}>
      <p>NearMe separates public discovery profiles from private contact information. Email addresses, mobile phone numbers, and social media channels default to Private and are never shown in search results or discovery cards.</p>
      <p>Nearby GPS discovery is opt-in only, stores quantized approximate grid coordinates with automatic expiration, and stops immediately when disabled.</p>
      <p>Under GDPR principles, you can edit, export, revoke visibility of any contact channel, or permanently delete your account at any time from Account Settings.</p>
    </PublicLegalShell>
  );
};

export const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !email.trim() || !message.trim()) return;
    setSubmitted(true);
    setSubject('');
    setMessage('');
  };

  return (
    <PublicLegalShell title={t('legal.contactTitle')}>
      {submitted && (
        <div className="p-3 rounded-xl bg-[#35C98A]/15 border border-[#35C98A]/30 text-[#35C98A] text-xs">
          {t('legal.contactSuccess')}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="contact-email" className="block text-xs font-medium mb-1">
            {t('auth.email')}
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="block text-xs font-medium mb-1">
            {t('legal.subjectLabel')}
          </label>
          <input
            id="contact-subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="contact-msg" className="block text-xs font-medium mb-1">
            {t('legal.messageLabel')}
          </label>
          <textarea
            id="contact-msg"
            rows={4}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-[#FF5277] text-white text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors"
        >
          {t('legal.sendBtn')}
        </button>
      </form>
    </PublicLegalShell>
  );
};
