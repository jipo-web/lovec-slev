import React from 'react';
import { DealItem } from '../types';
import { STORES } from '../data/stores';
import { FlyerCrop, hasCropData } from './FlyerCrop';
import { formatCzk, formatNum2, discountPct, MIN_VISIBLE_DISCOUNT_PCT, validityInfo } from '../utils/format';
import { X, ShieldCheck, AlertTriangle, AlertCircle, ShoppingBag, Calendar, Store, Check, BookOpen } from 'lucide-react';

interface DealDetailModalProps {
  deal: DealItem | null;
  exchangeRate: number;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (deal: DealItem) => void;
  isInCart: boolean;
  onOpenFlyerPage?: (deal: DealItem) => void;
}

export const DealDetailModal: React.FC<DealDetailModalProps> = ({
  deal,
  exchangeRate,
  isOpen,
  onClose,
  onAddToCart,
  isInCart,
  onOpenFlyerPage,
}) => {
  if (!isOpen || !deal) return null;

  const store = STORES[deal.store];
  const promoCzk = deal.promoPricePln * exchangeRate;
  const regularCzk = deal.regularPricePln * exchangeRate;
  const hasCzPrice = deal.czechEquivalentCzk > 0;
  const savingsVsCzCzk = hasCzPrice ? Math.max(0, deal.czechEquivalentCzk - promoCzk) : 0;
  const savingsVsCzPct = hasCzPrice ? Math.round((savingsVsCzCzk / deal.czechEquivalentCzk) * 100) : 0;
  const pct = discountPct(deal.promoPricePln, deal.regularPricePln);
  const showDiscount = pct != null && pct >= MIN_VISIBLE_DISCOUNT_PCT;
  const showPolishTitle = deal.polishTitle.trim().toLowerCase() !== deal.title.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-md tracking-wider uppercase font-mono text-white"
              style={{ backgroundColor: store.brandColor }}
            >
              {store.name}
            </span>
            {onOpenFlyerPage ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenFlyerPage(deal);
                }}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 underline decoration-dotted underline-offset-2"
                title="Zobrazit tuto stranu letáku"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Strana {deal.flyerPage} letáku</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Strana {deal.flyerPage} letáku</span>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
            aria-label="Zavřít"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Flyer crop */}
          {hasCropData(deal.pageImageUrl, deal.bbox) && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <FlyerCrop pageImageUrl={deal.pageImageUrl} bbox={deal.bbox} alt={deal.title} heightClass="h-72" />
            </div>
          )}

          {/* Titles */}
          <div>
            {showPolishTitle && (
              <div className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider mb-1">
                Polský název: {deal.polishTitle}
              </div>
            )}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
              {deal.title}
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              {deal.packageSize && <span>Balení: {deal.packageSize}</span>}
              {deal.unitPricePln != null && deal.unitPriceUnit && (
                <span>{formatNum2(deal.unitPricePln)} zł/{deal.unitPriceUnit}</span>
              )}
            </div>
            {deal.reason && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Hodnocení: {deal.reason}
              </p>
            )}
          </div>

          {/* Ojebometer Verdict Card */}
          <div className={`p-4 rounded-2xl border space-y-2 ${
            deal.trickType === 'clean'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : deal.trickType === 'conditional_card'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2 font-bold text-base">
              {deal.trickType === 'clean' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              ) : deal.trickType === 'conditional_card' ? (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
              <span>Hlídač chytáků: {deal.trickTitle}</span>
            </div>

            <p className="text-xs leading-relaxed opacity-95">
              {deal.trickExplanation}
            </p>

            {deal.minQuantity && deal.minQuantity > 1 && (
              <div className="text-xs font-mono font-semibold pt-1 border-t border-black/10 dark:border-white/10">
                👉 Minimální nákup pro získání slevy: {deal.minQuantity} ks!
              </div>
            )}

            {deal.maxLimit && (
              <div className="text-xs font-mono font-semibold">
                👉 Omezení: {deal.maxLimit}
              </div>
            )}
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Polská akční cena
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {formatNum2(deal.promoPricePln)} zł
              </div>
              <div className="text-xs font-bold text-red-600 dark:text-red-400 font-mono mt-0.5">
                ≈ {formatCzk(promoCzk)}
              </div>
              {showDiscount && (
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Běžná cena: {formatNum2(deal.regularPricePln)} zł ({formatCzk(regularCzk)}) · sleva {Math.round(pct!)} %
                </div>
              )}
            </div>

            {hasCzPrice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block mb-1">
                Srovnání s běžnou cenou v ČR
              </span>
              <div className="text-xl font-black text-slate-800 dark:text-slate-100 font-mono tabular-nums">
                ~{formatCzk(deal.czechEquivalentCzk)}
              </div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                Úspora: {formatCzk(savingsVsCzCzk)} (-{savingsVsCzPct} %)
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-mono mt-1">
                na 1 balení / měrnou jednotku
              </div>
            </div>
            )}
          </div>

          {/* Store App & Loyalty requirement checklist */}
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-slate-500" />
              <span>Podmínky pro nákup v řetězci {store.name}:</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {store.borderShopperTip}
            </p>
            <div className="pt-1 flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Platnost akce: {validityInfo(deal.validFrom, deal.validUntil).label}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Zavřít
          </button>

          <button
            onClick={() => {
              onAddToCart(deal);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all"
          >
            {isInCart ? (
              <>
                <Check className="w-4 h-4" />
                <span>V seznamu (přidat další kus)</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>Přidat do nákupního seznamu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
