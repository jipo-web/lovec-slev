import React, { useState } from 'react';
import { StoreId, DealItem } from '../types';
import { STORE_FLYERS } from '../data/flyers';
import { STORES } from '../data/stores';
import { DEALS } from '../data/deals';
import { ChevronLeft, ChevronRight, BookOpen, ExternalLink, Plus, Check, ShieldCheck, AlertTriangle, AlertCircle, ShoppingBag } from 'lucide-react';

interface FlyerReaderModalProps {
  initialStore: StoreId;
  exchangeRate: number;
  onAddToCart: (deal: DealItem) => void;
  cartItemIds: Set<string>;
}

export const FlyerReaderModal: React.FC<FlyerReaderModalProps> = ({
  initialStore,
  exchangeRate,
  onAddToCart,
  cartItemIds,
}) => {
  const [currentStore, setCurrentStore] = useState<StoreId>(initialStore || 'dino');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const flyer = STORE_FLYERS[currentStore];
  const storeInfo = STORES[currentStore];
  const activePageData = flyer.pages.find((p) => p.pageNumber === currentPage) || flyer.pages[0];

  // Deals on this page
  const pageDeals = DEALS.filter((d) => activePageData.dealIds.includes(d.id));

  const handleNextPage = () => {
    if (currentPage < flyer.pages.length) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Store switcher strip */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(Object.keys(STORE_FLYERS) as StoreId[]).map((sid) => {
            const isSelected = currentStore === sid;
            const sInfo = STORES[sid];
            return (
              <button
                key={sid}
                onClick={() => {
                  setCurrentStore(sid);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <span>{sInfo.name}</span>
                {sid === 'dino' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-normal">
                    marketdino.pl
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <a
          href={flyer.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <span>Oficiální online leták na webu</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Virtual Flyer Canvas */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
        {/* Flyer Header Banner */}
        <div 
          className="p-6 text-white relative overflow-hidden"
          style={{
            backgroundColor: currentStore === 'dino' ? '#991b1b' : currentStore === 'biedronka' ? '#b91c1c' : currentStore === 'lidl' ? '#004494' : currentStore === 'kaufland' ? '#b91c1c' : '#0369a1',
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-white/80 uppercase tracking-wider mb-1">
                <span>{storeInfo.tagline}</span>
                <span>·</span>
                <span>{flyer.edition}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {flyer.flyerTitle}
              </h2>
              <div className="text-xs font-mono text-white/90 mt-1">
                {flyer.validityRange}
              </div>
            </div>

            {/* Page navigation controls */}
            <div className="flex items-center gap-2 bg-black/25 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shrink-0">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-2 rounded-xl text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Předchozí strana"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-3 text-xs font-mono font-bold">
                Strana {currentPage} / {flyer.pages.length}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === flyer.pages.length}
                className="p-2 rounded-xl text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Další strana"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Current Page Sub-header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activePageData.title}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Téma strany: {activePageData.theme}
            </span>
          </div>

          {activePageData.bannerNote && (
            <div className="text-xs px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium">
              {activePageData.bannerNote}
            </div>
          )}
        </div>

        {/* Deals on this Flyer Page */}
        <div className="p-6">
          {pageDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pageDeals.map((deal) => {
                const promoCzk = deal.promoPricePln * exchangeRate;
                const savingsVsCzCzk = Math.max(0, deal.czechEquivalentCzk - promoCzk);
                const savingsVsCzPct = Math.round((savingsVsCzCzk / deal.czechEquivalentCzk) * 100);
                const isInCart = cartItemIds.has(deal.id);

                return (
                  <div
                    key={deal.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {deal.polishTitle.trim().toLowerCase() !== deal.title.trim().toLowerCase() && (
                            <span className="text-[11px] font-mono text-slate-400 block">{deal.polishTitle}</span>
                          )}
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            {deal.title}
                          </h4>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {deal.packageSize} ({deal.unit})
                          </span>
                        </div>

                        {savingsVsCzPct > 0 && (
                          <div className="text-right shrink-0">
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums block">
                              -{savingsVsCzPct} %
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              vs ČR
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pricing block */}
                      <div className="mt-3 flex items-baseline gap-3">
                        <span className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                          {deal.promoPricePln.toFixed(2)} PLN
                        </span>
                        <span className="text-xs text-slate-400 line-through font-mono">
                          {deal.regularPricePln.toFixed(2)} PLN
                        </span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">
                          ≈ {promoCzk.toFixed(1)} Kč
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          (v ČR ~{deal.czechEquivalentCzk} Kč)
                        </span>
                      </div>

                      {/* Ojebometer Tag */}
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                        {deal.trickType === 'clean' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : deal.trickType === 'conditional_card' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold">{deal.trickTitle}: </span>
                          <span className="opacity-90">{deal.trickExplanation}</span>
                        </div>
                      </div>
                    </div>

                    {/* Add to Cart button */}
                    <button
                      onClick={() => onAddToCart(deal)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isInCart
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      {isInCart ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>V nákupním seznamu (přidat další kus)</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Přidat tuto položku do seznamu</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <BookOpen className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-medium">
                Na této straně letáku jsou další sezónní nabídky a recepty z řetězce {storeInfo.name}.
              </p>
              <a
                href={flyer.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold hover:underline"
              >
                Prohlédnout celý tištěný PDF leták na webu {storeInfo.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Bottom Page Thumbnails */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center gap-2">
          {flyer.pages.map((p) => (
            <button
              key={p.pageNumber}
              onClick={() => setCurrentPage(p.pageNumber)}
              className={`w-9 h-9 rounded-xl text-xs font-mono font-bold transition-all ${
                currentPage === p.pageNumber
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {p.pageNumber}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
