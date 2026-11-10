import React from 'react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showText?: boolean;
  subtext?: string;
  variant?: 'default' | 'white';
  className?: string;
  animate?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  showText = false,
  subtext,
  variant = 'default',
  className = '',
  animate = false,
}) => {
  const sizeMap = {
    sm: { box: 'w-7 h-7', text: 'text-base', sub: 'text-[10px]' },
    md: { box: 'w-9 h-9', text: 'text-xl', sub: 'text-xs' },
    lg: { box: 'w-12 h-12', text: 'text-2xl', sub: 'text-xs' },
    xl: { box: 'w-16 h-16', text: 'text-3xl', sub: 'text-sm' },
    hero: { box: 'w-20 h-20', text: 'text-4xl', sub: 'text-base' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Brand SVG Emblem */}
      <div
        className={`relative ${currentSize.box} shrink-0 select-none ${
          animate ? 'transition-transform duration-300 hover:scale-105' : ''
        }`}
      >
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full drop-shadow-xs"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="100%" stopColor="#0D9488" />
            </linearGradient>
            <linearGradient id="logoPillWhite" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F0FDFA" />
            </linearGradient>
            <linearGradient id="logoPillMint" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
          </defs>

          {/* Squircle base */}
          <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#logoBgGrad)" />

          {/* Protective Heart Outline */}
          <path
            d="M32 14 C39 7, 52 10, 52 23 C52 35, 38 45, 32 50 C26 45, 12 35, 12 23 C12 10, 25 7, 32 14 Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Angled Medicine Capsule */}
          <g transform="translate(32, 31) rotate(-40)">
            {/* Top White Half */}
            <path d="M-6.5,-12 C-6.5,-17 6.5,-17 6.5,-12 L6.5,0 L-6.5,0 Z" fill="url(#logoPillWhite)" />
            {/* Bottom Mint Half */}
            <path d="M-6.5,0 L6.5,0 L6.5,12 C6.5,17 -6.5,17 -6.5,12 Z" fill="url(#logoPillMint)" />
            {/* Center Separation */}
            <line x1="-6.5" y1="0" x2="6.5" y2="0" stroke="#0F766E" strokeWidth="1.2" />
            {/* Highlight */}
            <rect x="-4" y="-11" width="1.5" height="7" rx="0.75" fill="rgba(255,255,255,0.7)" />
          </g>

          {/* Care Sparkle */}
          <circle cx="44" cy="20" r="2.8" fill="#FACC15" />
          <path
            d="M44 15.5 L44 24.5 M39.5 20 L48.5 20"
            stroke="#FEF08A"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left leading-tight">
          <span
            className={`font-bold tracking-tight ${currentSize.text} ${
              variant === 'white'
                ? 'text-white'
                : 'text-teal-900 dark:text-teal-300'
            }`}
          >
            স্বাস্থ্যবন্ধু
          </span>
          {subtext ? (
            <span
              className={`${currentSize.sub} font-medium ${
                variant === 'white'
                  ? 'text-teal-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {subtext}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};
