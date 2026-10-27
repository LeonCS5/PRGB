import React, { useId } from 'react';

export interface BrandMarkProps {
  size?: number;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 36, className = '' }) => {
  const gradientId = useId();
  return (
    <span className={`inline-flex shrink-0 items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffb066" />
            <stop offset="0.55" stopColor="#ff7a1a" />
            <stop offset="1" stopColor="#d94f00" />
          </linearGradient>
        </defs>
        <path d="M32 61C21.5 51.5 5 34.5 5 19.5 5 9 17 3 32 3s27 6 27 16.5C59 34.5 42.5 51.5 32 61Z" fill={`url(#${gradientId})`} />
        <path d="M14 25h6l4-9 6 18 5-14 4 8 3-3h8" stroke="currentColor" className="text-ink-950" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-2xl font-bold tracking-tight text-ink-100">PRGB</span>
    </span>
  );
};
