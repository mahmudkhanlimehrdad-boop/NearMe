import React from 'react';

export const NearMeLogo: React.FC<{ size?: number; showWordmark?: boolean }> = ({
  size = 28,
  showWordmark = true,
}) => {
  return (
    <span className="inline-flex items-center gap-2.5 shrink-0 whitespace-nowrap">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="nearme-brand-grad" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF5277" />
            <stop offset="55%" stopColor="#D664B8" />
            <stop offset="100%" stopColor="#9B7BFF" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#171C28" />
        <path
          d="M32 50C32 50 14 38.5 14 25C14 18.8 19 14 25 14C28.6 14 31 15.8 32 17.8C33 15.8 35.4 14 39 14C45 14 50 18.8 50 25C50 38.5 32 50 32 50Z"
          stroke="url(#nearme-brand-grad)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="27" r="4.5" fill="#FF8EAA" />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          NearMe
        </span>
      )}
    </span>
  );
};

export const NearMeSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border-2 border-[#FF5277]/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#FF5277] border-r-[#9B7BFF] animate-spin" />
    </div>
    {label && <p className="text-sm text-slate-500 dark:text-[#A7AFBF]">{label}</p>}
  </div>
);
