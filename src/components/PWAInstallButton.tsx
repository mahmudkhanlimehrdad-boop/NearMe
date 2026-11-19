import React, { useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-xl bg-[#202737] border border-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-[#2a3347] transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-[#FF5277]" />
        {!compact && <span>{t('pwa.installApp')}</span>}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 px-3 py-2 text-xs font-medium text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#FF5277]" />
          {!compact && <span>{t('pwa.installIos')}</span>}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('pwa.iosTitle')}
              </h3>
              <div className="space-y-2 text-sm text-slate-600 dark:text-[#A7AFBF]">
                <p>{t('pwa.iosStep1')}</p>
                <p>{t('pwa.iosStep2')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#FF5277] text-white text-sm font-medium"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
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
