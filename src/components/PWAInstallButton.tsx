import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, ExternalLink, Laptop, Smartphone, WifiOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!showGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showGuide]);

  if (isInstalled) return null;

  const websiteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const currentPageUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  const handleCopyLink = async () => {
    if (!websiteUrl) return;
    try {
      await navigator.clipboard.writeText(websiteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored if clipboard permissions are restricted
    }
  };

  const modalContent =
    showGuide && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-dialog-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowGuide(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl text-slate-900 dark:text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="NearMe App Icon"
                    className="w-12 h-12 rounded-xl border border-slate-200 dark:border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3
                      id="pwa-install-dialog-title"
                      className="font-display text-base sm:text-lg font-bold leading-snug"
                    >
                      {t('pwa.modalTitle')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#A7AFBF] font-mono truncate">
                      {websiteUrl}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label={t('common.close')}
                  className="p-2 rounded-xl text-slate-500 dark:text-[#A7AFBF] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                {t('pwa.modalDesc')}
              </p>

              {isInIframe && (
                <div className="rounded-xl bg-[#FF5277]/10 border border-[#FF5277]/30 p-3.5 space-y-3">
                  <p className="text-xs text-slate-700 dark:text-[#F4F6FA] leading-relaxed">
                    {t('pwa.iframeHint')}
                  </p>
                  <a
                    href={currentPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#FF5277] text-white text-xs sm:text-sm font-semibold hover:bg-[#FF5277]/90 transition-colors"
                  >
                    <span>{t('pwa.openWebsiteBtn')}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                {!isInIframe && (
                  <a
                    href={currentPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-[#FF5277] text-white text-xs font-semibold hover:bg-[#FF5277]/90 transition-colors"
                  >
                    <span>{t('pwa.openWebsiteBtn')}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#35C98A] shrink-0" />
                      <span>{t('pwa.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#9B7BFF] shrink-0" />
                      <span>{t('pwa.copyLink')}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {!isAndroid && (
                  <div className="rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <Smartphone className="w-4 h-4 text-[#FF5277] shrink-0" />
                      <span>{t('pwa.iosTitle')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">{t('pwa.iosStep1')}</p>
                    <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">{t('pwa.iosStep2')}</p>
                    <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">{t('pwa.iosStep3')}</p>
                  </div>
                )}

                {!isIOS && (
                  <div className="rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <Smartphone className="w-4 h-4 text-[#35C98A] shrink-0" />
                      <span>{t('pwa.androidTitle')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">{t('pwa.androidStep1')}</p>
                    <p className="text-xs text-slate-600 dark:text-[#A7AFBF]">{t('pwa.androidStep2')}</p>
                  </div>
                )}

                {!isIOS && !isAndroid && (
                  <div className="rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <Laptop className="w-4 h-4 text-[#9B7BFF] shrink-0" />
                      <span>{t('pwa.desktopTitle')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-[#A7AFBF] leading-relaxed">
                      {t('pwa.desktopNote')}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-xs sm:text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t('pwa.installApp')}
        title={t('pwa.installApp')}
        data-testid="pwa-install-btn"
        className={
          compact
            ? 'inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-[#202737] border border-slate-300 dark:border-white/10 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#171C28] border border-slate-300 dark:border-white/15 px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-[#202737] transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 text-[#FF5277] shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          {compact ? t('pwa.installShort') : t('pwa.installApp')}
        </span>
      </button>
      {modalContent}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 start-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{t('pwa.offline')}</span>
    </div>
  );
};
