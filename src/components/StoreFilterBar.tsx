import React from 'react';
import { StoreId } from '../types';
import { STORES } from '../data/stores';
import { CheckCircle2, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';

interface StoreFilterBarProps {
  selectedStore: StoreId | 'all';
  onSelectStore: (store: StoreId | 'all') => void;
  dealCountsByStore: Record<StoreId, number>;
}

export const StoreFilterBar: React.FC<StoreFilterBarProps> = ({
  selectedStore,
  onSelectStore,
  dealCountsByStore,
}) => {
  const storeList: { id: StoreId | 'all'; label: string; badge?: string }[] = [
    { id: 'all', label: 'Všechny řetězce' },
    { id: 'dino', label: 'Dino (marketdino.pl)', badge: 'Bez karty' },
    { id: 'biedronka', label: 'Biedronka', badge: 'Moja Biedronka' },
    { id: 'lidl', label: 'Lidl Polska', badge: 'Lidl Plus PL' },
    { id: 'kaufland', label: 'Kaufland PL', badge: 'Kaufland Card PL' },
    { id: 'carrefour', label: 'Carrefour PL', badge: 'Mój Carrefour' },
  ];

  const currentStoreInfo = selectedStore !== 'all' ? STORES[selectedStore] : null;

  return (
    <div className="space-y-3">
      {/* Horizontal store selection strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {storeList.map((item) => {
          const isSelected = selectedStore === item.id;
          const count = item.id === 'all' 
            ? Object.values(dealCountsByStore).reduce((a, b) => a + b, 0)
            : dealCountsByStore[item.id as StoreId] || 0;

          return (
            <button
              key={item.id}
              onClick={() => onSelectStore(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
                  : 'bg-white text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums ${
                  isSelected
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
              {item.badge && (
                <span className={`text-[10px] hidden sm:inline ${isSelected ? 'opacity-90' : 'text-slate-400'}`}>
                  · {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Store Pro-Tip Banner if specific store is selected */}
      {currentStoreInfo && (
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pravidlo pro {currentStoreInfo.name}:</span>
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  {currentStoreInfo.requiresApp ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Nutná polská aplikace / karta ({currentStoreInfo.loyaltyCardName})</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Akce pro každého (bez karty!)</span>
                  )}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {currentStoreInfo.borderShopperTip}
              </p>
            </div>
          </div>

          <a
            href={currentStoreInfo.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-[11px] font-medium shrink-0"
          >
            <span>Oficiální web {currentStoreInfo.name}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
