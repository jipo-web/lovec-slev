import React from 'react';
import { CategoryId, TrickType } from '../types';
import { Search, SlidersHorizontal, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

interface FilterToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: CategoryId;
  onCategoryChange: (cat: CategoryId) => void;
  selectedTrickType: TrickType | 'all';
  onTrickTypeChange: (trick: TrickType | 'all') => void;
  sortBy: 'savings_pct' | 'price_asc' | 'discount_pln' | 'title';
  onSortChange: (sort: 'savings_pct' | 'price_asc' | 'discount_pln' | 'title') => void;
  resultsCount: number;
}

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
  ];

  return (
    <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
      {/* Top search & sorting row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Hledat máslo, schab, kávu, prací prášek, Dino..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Řadit:
          </span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 font-medium"
          >
            <option value="savings_pct">Největší úspora vs ČR (%)</option>
            <option value="price_asc">Nejlevnější cena (CZK)</option>
            <option value="discount_pln">Nejvyšší sleva v letáku (PLN)</option>
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

        <div className="text-slate-400 text-[11px] font-mono tabular-nums">
          Nalezeno {resultsCount} {resultsCount === 1 ? 'položka' : resultsCount < 5 ? 'položky' : 'položek'}
        </div>
      </div>
    </div>
  );
};
