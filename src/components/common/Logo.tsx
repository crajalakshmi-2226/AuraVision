import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false, className = '' }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Custom Abstract Logo: Open letter 'A' + small star + protective orbital curves */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center shrink-0`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full filter drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]"
        >
          {/* Outer Protective Orbital / Shield Curve */}
          <path
            d="M 6 18 C 6 8, 16 4, 24 4 C 32 4, 42 8, 42 18 C 42 32, 28 42, 24 44 C 20 42, 6 32, 6 18 Z"
            stroke="url(#shield-grad)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="4 2"
            className="opacity-70"
          />

          {/* Inner Orbital Orbit Ring */}
          <path
            d="M 10 24 C 10 16, 18 10, 24 10 C 33 10, 39 18, 38 28 C 37 34, 30 38, 24 38"
            stroke="url(#orbit-grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Open Letter 'A' Stylized Apex & Legs */}
          <path
            d="M 15 36 L 24 13 L 33 36"
            stroke="url(#letter-grad)"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Crossbar with open tech gap */}
          <path
            d="M 18.5 28 L 22 28"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 26 28 L 29.5 28"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Small Radiant Spark / Star at Apex */}
          <path
            d="M 24 9.5 L 24.8 12.2 L 27.5 13 L 24.8 13.8 L 24 16.5 L 23.2 13.8 L 20.5 13 L 23.2 12.2 Z"
            fill="#38bdf8"
          />

          {/* Focal Precision Core Pip */}
          <circle cx="24" cy="22" r="1.5" fill="#a855f7" />

          <defs>
            <linearGradient id="shield-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.5" stopColor="#6366f1" />
              <stop offset="1" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="orbit-grad" x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06b6d4" />
              <stop offset="1" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="letter-grad" x1="15" y1="13" x2="33" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f8fafc" />
              <stop offset="0.5" stopColor="#38bdf8" />
              <stop offset="1" stopColor="#818cf8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`font-heading font-bold tracking-wider text-slate-100 ${textSizes[size]}`}>
            AURA<span className="text-cyan-400">VISION</span>
          </span>
          <span className="font-hud text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
            AI
          </span>
        </div>
        {showTagline && (
          <span className="text-[11px] text-slate-400 tracking-wide font-normal">
            See Beyond. Predict Risks. Protect Lives.
          </span>
        )}
      </div>
    </div>
  );
};
