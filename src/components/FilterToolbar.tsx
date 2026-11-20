import React from 'react';
import { CategoryId, SortKey, TrickType, Verdict } from '../types';
import { Search, SlidersHorizontal, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

interface FilterToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: CategoryId;
  onCategoryChange: (cat: CategoryId) => void;
  selectedTrickType: TrickType | 'all';
  onTrickTypeChange: (trick: TrickType | 'all') => void;
  sortBy: SortKey;
  onSortChange: (sort: SortKey) => void;
  resultsCount: number;
  hasVerdicts?: boolean;
  /** Czech reference prices exist – only then may we offer a "savings vs ČR" sort. */
  hasCzechPrices?: boolean;
  selectedVerdict?: Verdict | 'all';
  onVerdictChange?: (verdict: Verdict | 'all') => void;
}

const VERDICT_FILTERS: { id: Verdict | 'all'; label: string; active: string; idle: string }[] = [
  { id: 'all', label: 'Vše', active: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900', idle: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800' },
  { id: 'trhak', label: 'Trhák', active: 'bg-emerald-600 text-white', idle: 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
  { id: 'dobra_koupe', label: 'Dobrá koupě', active: 'bg-sky-600 text-white', idle: 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30' },
  { id: 'nic_moc', label: 'Nic moc', active: 'bg-slate-600 text-white', idle: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800' },
  { id: 'past', label: 'Past', active: 'bg-rose-600 text-white', idle: 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30' },
];

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedTrickType,
  onTrickTypeChange,
  sortBy,
  onSortChange,
  resultsCount,
  hasVerdicts = false,
  hasCzechPrices = false,
  selectedVerdict = 'all',
  onVerdictChange,
}) => {
  const categories: { id: CategoryId; label: string }[] = [
    { id: 'all', label: 'Všechny kategorie' },
    { id: 'maso', label: '🥩 Maso a uzeniny' },
    { id: 'mlecne', label: '🧀 Mléčné & sýry' },
    { id: 'kava', label: '☕ Káva & čaj' },
    { id: 'drogerie', label: '🧼 Drogerie & praní' },
    { id: 'trvanlive', label: '🌾 Trvanlivé potraviny' },
    { id: 'napoje', label: '🍺 Nápoje & pivo' },
    { id: 'sladkosti', label: '🍫 Sladkosti' },
    { id: 'ovoce_zelenina', label: '🥬 Ovoce & zelenina' },
  ];

  return (
    <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
      {/* Top search & sorting row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="masło, schab, kawa, proszek, Dino…"
              aria-label="Hledat zboží (polsky)"
              aria-describedby="search-hint"
              enterKeyHint="search"
              className="w-full pl-9 pr-10 py-2 text-base sm:text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Smazat hledání"
              >
                ✕
              </button>
            )}
          </div>
          <p id="search-hint" className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
            Názvy jsou v originále, jak je uvidíte v regálu – hledejte polsky. Diakritika není nutná (<em>maslo</em> najde <em>masło</em>), více slov se kombinuje.
          </p>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort-select" className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" /> Řadit:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 font-medium"
          >
            {hasVerdicts && <option value="score">Nejlepší nabídky (skóre)</option>}
            {hasCzechPrices && <option value="savings_pct">Největší úspora proti ČR (%)</option>}
            <option value="discount_pct">Největší sleva v letáku (%)</option>
            <option value="discount_pln">Nejvyšší sleva v letáku (zł)</option>
            <option value="price_asc">Nejnižší cena</option>
            <option value="title">Název produktu (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Category horizontal scroll */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            aria-pressed={selectedCategory === cat.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Ojebometer / Trick filter strip */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 dark:text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Hlídač chytáků:
          </span>

          <button
            onClick={() => onTrickTypeChange('all')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              selectedTrickType === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Všechny slevy
          </button>

          <button
            onClick={() => onTrickTypeChange('clean')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              selectedTrickType === 'clean'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Čisté slevy (pro každého)</span>
          </button>

          <button
            onClick={() => onTrickTypeChange('conditional_card')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              selectedTrickType === 'conditional_card'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>S věrnostní kartou / aplikací</span>
          </button>

          <button
            onClick={() => onTrickTypeChange('trick_warning')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              selectedTrickType === 'trick_warning'
                ? 'bg-rose-600 text-white font-semibold'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Pozor na chyták (multi-buy, limity)</span>
          </button>
        </div>

        {hasVerdicts && onVerdictChange && (
          <div className="flex items-center gap-1.5 flex-wrap w-full">
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1">Verdikt:</span>
            {VERDICT_FILTERS.map((v) => (
              <button
                key={v.id}
                onClick={() => onVerdictChange(v.id)}
                aria-pressed={selectedVerdict === v.id}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedVerdict === v.id ? `${v.active} font-semibold` : v.idle
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className="text-slate-600 dark:text-slate-400 text-[11px] font-mono tabular-nums" role="status" aria-live="polite">
          Nalezeno {resultsCount} {resultsCount === 1 ? 'položka' : resultsCount >= 2 && resultsCount <= 4 ? 'položky' : 'položek'}
        </div>
      </div>
    </div>
  );
};
