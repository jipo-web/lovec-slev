import React from 'react';

interface LogoMarkProps {
  className?: string;
  /** Barva terče a hrotů. Výchozí: značková červená. */
  color?: string;
  /** Barva cenovky. Výchozí: dědí z `currentColor` (tmavá ve světlém režimu, bílá v tmavém). */
  tagColor?: string;
  /** Barva textu „zł“ a dírky na cenovce. */
  tagTextColor?: string;
}

/**
 * Samotný symbol: terč (lovec) s cenovkou „zł“ (polské ceny).
 * Používá `currentColor` pro cenovku, takže se přizpůsobí dark módu podle rodiče.
 */
export const LogoMark: React.FC<LogoMarkProps> = ({
  className = 'w-9 h-9',
  color = '#D81E3A',
  tagColor = 'currentColor',
  tagTextColor,
}) => (
  <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6" />
    <line x1="50" y1="2" x2="50" y2="18" stroke={color} strokeWidth="6" strokeLinecap="round" />
    <line x1="50" y1="82" x2="50" y2="98" stroke={color} strokeWidth="6" strokeLinecap="round" />
    <line x1="2" y1="50" x2="18" y2="50" stroke={color} strokeWidth="6" strokeLinecap="round" />
    <line x1="82" y1="50" x2="98" y2="50" stroke={color} strokeWidth="6" strokeLinecap="round" />
    <g transform="rotate(-25 50 50)">
      <path d="M26 36 H60 L76 50 L60 64 H26 Q22 64 22 60 V40 Q22 36 26 36 Z" fill={tagColor} />
      <circle cx="31" cy="50" r="3.2" className={tagTextColor ? undefined : 'fill-white dark:fill-slate-900'} fill={tagTextColor} />
      <text
        x="51"
        y="56.5"
        textAnchor="middle"
        fontWeight="800"
        fontSize="17"
        className={tagTextColor ? undefined : 'fill-white dark:fill-slate-900'}
        fill={tagTextColor}
        style={{ fontFamily: 'inherit' }}
      >
        zł
      </text>
    </g>
  </svg>
);

/** Malá polská vlajka (bílá/červená) ke sloganu. */
export const PolishFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-[14px]' }) => (
  <svg viewBox="0 0 36 24" className={className} role="img" aria-label="Polsko">
    <rect x="0.5" y="0.5" width="35" height="23" rx="3" className="fill-white stroke-slate-300 dark:stroke-slate-500" />
    <path d="M0.5 12 H35.5 V20.5 Q35.5 23.5 32.5 23.5 H3.5 Q0.5 23.5 0.5 20.5 Z" fill="#D81E3A" />
  </svg>
);

interface LogoProps {
  /** Zobrazit slogan „slevy z polských obchodů“ pod wordmarkem. */
  withTagline?: boolean;
  className?: string;
}

/** Kompletní logo: symbol + wordmark „Lovec-slev.cz“ (+ volitelný slogan). */
export const Logo: React.FC<LogoProps> = ({ withTagline = true, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 text-slate-900 dark:text-white ${className}`}>
    <LogoMark className="w-9 h-9 shrink-0" />
    <span className="flex flex-col leading-tight">
      <span className="text-lg font-extrabold tracking-tight whitespace-nowrap">
        Lovec<span className="text-[#D81E3A]">-slev</span>
        <span className="font-medium text-slate-400 dark:text-slate-500">.cz</span>
      </span>
      {withTagline && (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <PolishFlag className="w-4 h-[11px]" />
          slevy z polských obchodů
        </span>
      )}
    </span>
  </span>
);
