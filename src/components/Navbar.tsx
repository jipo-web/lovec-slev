import React from 'react';
import { ShoppingBag, RefreshCw, Sun, Moon, Info, BookOpen, Tag } from 'lucide-react';

interface NavbarProps {
  activeTab: 'deals' | 'flyers' | 'guide';
  setActiveTab: (tab: 'deals' | 'flyers' | 'guide') => void;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  cartCount: number;
  cartTotalCzk: number;
  totalSavedCzk: number;
  onOpenCart: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  exchangeRate,
  setExchangeRate,
  cartCount,
  cartTotalCzk,
  totalSavedCzk,
  onOpenCart,
  isDarkMode,
  toggleDarkMode,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('deals')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:bg-red-700 transition-colors">
                PL
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap block leading-tight">
                  Lovec <span className="text-red-600">slev</span>
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block leading-tight">
                  Hlídač chytáků v polských letácích
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Clean nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              onClick={() => setActiveTab('deals')}
              className={`flex items-center gap-2 whitespace-nowrap py-1 border-b-2 transition-colors ${
                activeTab === 'deals'
                  ? 'border-red-600 text-red-600 dark:text-red-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Akce & Srovnání cen</span>
            </button>

            <button
              onClick={() => setActiveTab('flyers')}
              className={`flex items-center gap-2 whitespace-nowrap py-1 border-b-2 transition-colors ${
                activeTab === 'flyers'
                  ? 'border-red-600 text-red-600 dark:text-red-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Listování letáky</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 whitespace-nowrap py-1 border-b-2 transition-colors ${
                activeTab === 'guide'
                  ? 'border-red-600 text-red-600 dark:text-red-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Příhraniční rádce (DCC & tipy)</span>
            </button>
          </nav>

          {/* Zone 3: Actions & Shopping List CTA */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live Exchange Rate Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-500 dark:text-slate-400">1 PLN =</span>
              <input
                type="number"
                step="0.05"
                min="4"
                max="8"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Math.max(3, parseFloat(e.target.value) || 5.85))}
                className="w-12 bg-transparent text-slate-900 dark:text-white font-mono font-bold text-center border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-red-500"
                title="Kliknutím upravíte kurz pro přepočet"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Kč</span>
            </div>

            {/* Dark mode button */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
              aria-label="Přepnout motiv vzhledu"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Shopping List Button */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-sm transition-all whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Nákupní seznam</span>
              {cartCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white text-red-700 font-bold text-[11px] font-mono tabular-nums">
                  {cartCount}
                </span>
              )}
              {cartCount > 0 && (
                <span className="hidden lg:inline text-red-100 font-mono text-[11px]">
                  ({Math.round(cartTotalCzk)} Kč)
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile secondary tab strip */}
        <div className="flex md:hidden border-t border-slate-100 dark:border-slate-800 py-2 gap-4 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('deals')}
            className={`whitespace-nowrap px-2.5 py-1 rounded ${
              activeTab === 'deals' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Akce & Srovnání
          </button>
          <button
            onClick={() => setActiveTab('flyers')}
            className={`whitespace-nowrap px-2.5 py-1 rounded ${
              activeTab === 'flyers' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Listování letáky
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`whitespace-nowrap px-2.5 py-1 rounded ${
              activeTab === 'guide' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Příhraniční rádce
          </button>
        </div>
      </div>
    </header>
  );
};
