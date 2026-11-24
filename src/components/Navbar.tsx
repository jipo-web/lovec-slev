import React from 'react';
import { ShoppingBag, RefreshCw, Sun, Moon, Info, BookOpen, Tag } from 'lucide-react';
import { Logo } from './Logo';

interface NavbarProps {
  activeTab: 'deals' | 'flyers' | 'guide' | 'privacy';
  setActiveTab: (tab: 'deals' | 'flyers' | 'guide' | 'privacy') => void;
  /** Back to the homepage: deals tab, filters reset, scrolled to top. */
  onGoHome: () => void;
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
  onGoHome,
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
        <div className="flex items-center justify-between gap-3 md:gap-8 h-16 min-w-0">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <a
              href={import.meta.env.BASE_URL}
              onClick={(e) => {
                // Let Ctrl/Cmd/middle click open a new tab; plain click stays in the app.
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onGoHome();
              }}
              className="flex items-center text-left group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              title="Lovec-slev.cz – úvodní stránka"
              aria-label="Lovec-slev.cz – úvodní stránka"
            >
              <Logo />
            </a>
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
              <span>Akce</span>
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
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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
                aria-label="Kurz: kolik Kč za 1 zł"
                className="w-12 bg-transparent text-slate-900 dark:text-white font-mono font-bold text-center border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-red-500"
                title="Kliknutím upravíte kurz pro přepočet"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Kč</span>
            </div>

            {/* Dark mode button */}
            <button
              onClick={toggleDarkMode}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
              aria-label="Přepnout motiv vzhledu"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Shopping List Button */}
            <button
              onClick={onOpenCart}
              aria-label={cartCount > 0 ? `Nákupní seznam, ${cartCount} ks` : 'Nákupní seznam'}
              className="flex items-center gap-2 sm:gap-2.5 h-10 px-3 sm:px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-sm transition-all whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Nákupní seznam</span>
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
        <nav aria-label="Sekce webu" className="grid grid-cols-3 md:hidden border-t border-slate-100 dark:border-slate-800 py-1.5 gap-1 text-sm font-medium">
          <button
            onClick={() => setActiveTab('deals')}
            aria-current={activeTab === 'deals' ? 'page' : undefined}
            className={`whitespace-nowrap min-h-10 px-2 py-1.5 rounded-lg text-center ${
              activeTab === 'deals' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Akce
          </button>
          <button
            onClick={() => setActiveTab('flyers')}
            aria-current={activeTab === 'flyers' ? 'page' : undefined}
            className={`whitespace-nowrap min-h-10 px-2 py-1.5 rounded-lg text-center ${
              activeTab === 'flyers' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Letáky
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            aria-current={activeTab === 'guide' ? 'page' : undefined}
            className={`whitespace-nowrap min-h-10 px-2 py-1.5 rounded-lg text-center ${
              activeTab === 'guide' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Rádce
          </button>
        </nav>
      </div>
    </header>
  );
};
