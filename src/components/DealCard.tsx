import React from 'react';
import { DealItem, Verdict } from '../types';
import { STORES } from '../data/stores';
import { FlyerCrop } from './FlyerCrop';
import { formatCzk, formatNum2, discountPct, MIN_VISIBLE_DISCOUNT_PCT } from '../utils/format';
import { Plus, Minus, ShieldCheck, AlertTriangle, AlertCircle, BookOpen, Flame } from 'lucide-react';

const VERDICT_STYLES: Record<Verdict, { label: string; cls: string }> = {
  trhak: {
    label: 'Trhák',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  dobra_koupe: {
    label: 'Dobrá koupě',
    cls: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  },
  nic_moc: {
    label: 'Nic moc',
    cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  past: {
    label: 'Past',
    cls: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  },
};

/** One-line summary of the deal conditions; the full OCR text lives in the detail modal. */
export function conditionSummary(deal: DealItem): string {
  const parts: string[] = [];
  if (deal.requiredCard) parts.push(`Jen s ${deal.requiredCard}`);
  else if (deal.trickType === 'conditional_card') parts.push('Jen s aplikací / kartou');
  if (deal.minQuantity && deal.minQuantity > 1) parts.push(`min. ${deal.minQuantity} ks`);
  if (deal.maxLimit) parts.push(deal.maxLimit.replace(/^Max\s+/i, 'max. '));
  if (parts.length === 0 && deal.trickType === 'trick_warning') parts.push('Platí jen za podmínek – viz detail');
  return parts.join(' · ');
}

interface DealCardProps {
  deal: DealItem;
  exchangeRate: number;
  cartQuantity: number;
  onAddToCart: (deal: DealItem) => void;
  onUpdateQuantity: (dealId: string, quantity: number) => void;
  onOpenTrickModal: (deal: DealItem) => void;
  onOpenFlyerPage?: (deal: DealItem) => void;
  /** Rank 1..n when the card is part of the "top deals" strip. */
  topRank?: number;
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  exchangeRate,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onOpenTrickModal,
  onOpenFlyerPage,
  topRank,
}) => {
  const store = STORES[deal.store];
  const promoCzk = deal.promoPricePln * exchangeRate;
  const hasCzPrice = deal.czechEquivalentCzk > 0;
  const savingsVsCzCzk = hasCzPrice ? Math.max(0, deal.czechEquivalentCzk - promoCzk) : 0;
  const savingsVsCzPct = hasCzPrice ? Math.round((savingsVsCzCzk / deal.czechEquivalentCzk) * 100) : 0;
  const verdictBadge = deal.verdict ? VERDICT_STYLES[deal.verdict] : null;

  const pct = discountPct(deal.promoPricePln, deal.regularPricePln);
  const showDiscount = pct != null && pct >= MIN_VISIBLE_DISCOUNT_PCT;

  const showPolishTitle =
    deal.polishTitle && deal.polishTitle.trim().toLowerCase() !== deal.title.trim().toLowerCase();

  const conditions = conditionSummary(deal);
  const conditionStyle =
    deal.trickType === 'clean'
      ? {
          icon: <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />,
          cls: 'text-emerald-800 dark:text-emerald-300',
          text: 'Čistá sleva – bez karty a bez podmínek',
        }
      : deal.trickType === 'conditional_card'
        ? {
            icon: <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />,
            cls: 'text-amber-800 dark:text-amber-300',
            text: conditions,
          }
        : {
            icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />,
            cls: 'text-rose-800 dark:text-rose-300',
            text: conditions,
          };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group ${
        topRank ? 'border-amber-300 dark:border-amber-700/70' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Header: store, flyer page link, rank */}
      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-800/40">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase font-mono text-white shrink-0"
            style={{ backgroundColor: store.brandColor }}
          >
            {store.name}
          </span>
          {onOpenFlyerPage ? (
            <button
              onClick={() => onOpenFlyerPage(deal)}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 font-medium underline decoration-dotted underline-offset-2 truncate"
              title="Zobrazit tuto stranu letáku"
            >
              <BookOpen className="w-3 h-3 shrink-0" />
              <span>Strana {deal.flyerPage} letáku</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Strana {deal.flyerPage} letáku</span>
          )}
        </div>
        {topRank && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
            <Flame className="w-3 h-3" /> TOP {topRank}
          </span>
        )}
      </div>

      {/* Flyer crop (always rendered so cards keep a uniform layout) */}
      <button
        onClick={() => onOpenTrickModal(deal)}
        className="block w-full border-b border-slate-100 dark:border-slate-800"
        title="Zobrazit detail a rozbor akce"
      >
        <FlyerCrop pageImageUrl={deal.pageImageUrl} bbox={deal.bbox} alt={deal.title} heightClass="h-40" />
      </button>

      {/* Title & badges */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold leading-snug line-clamp-2">
              <button
                onClick={() => onOpenTrickModal(deal)}
                className="text-left text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Zobrazit detail a rozbor akce"
              >
                {deal.title}
              </button>
            </h3>
            {showPolishTitle && (
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{deal.polishTitle}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {deal.packageSize && <span>{deal.packageSize}</span>}
              {deal.unitPricePln != null && deal.unitPriceUnit && (
                <span className="tabular-nums">
                  {formatNum2(deal.unitPricePln)} zł/{deal.unitPriceUnit}
                </span>
              )}
              {verdictBadge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border font-sans ${verdictBadge.cls}`}>
                  {verdictBadge.label}
                </span>
              )}
            </div>
          </div>

          {savingsVsCzPct > 0 && (
            <div className="text-right shrink-0">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block">Úspora vs ČR</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums leading-none block">
                -{savingsVsCzPct} %
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="px-4 pb-3 mt-auto">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {formatNum2(deal.promoPricePln)}
                <span className="text-sm font-bold text-slate-500 ml-1">zł</span>
              </span>
              {showDiscount && (
                <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                  {formatNum2(deal.regularPricePln)} zł
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-red-600 dark:text-red-400 font-mono tabular-nums">
              ≈ {formatCzk(promoCzk)}
            </div>
          </div>
          {showDiscount && (
            <span className="text-sm font-black px-2 py-1 rounded-lg bg-red-600 text-white font-mono tabular-nums">
              -{Math.round(pct!)} %
            </span>
          )}
          {!showDiscount && hasCzPrice && (
            <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
              v ČR ~{formatCzk(deal.czechEquivalentCzk)}
            </div>
          )}
        </div>

        {/* Conditions – one line, details in the modal */}
        <button
          onClick={() => onOpenTrickModal(deal)}
          className={`mt-2.5 w-full flex items-center gap-1.5 text-[11px] font-medium text-left ${conditionStyle.cls} hover:underline decoration-dotted underline-offset-2`}
          title="Zobrazit celé podmínky akce"
        >
          {conditionStyle.icon}
          <span className="truncate">{conditionStyle.text}</span>
        </button>
      </div>

      {/* Footer: add to list */}
      <div className="px-4 pb-3.5">
        {cartQuantity > 0 ? (
          <div className="flex items-center justify-between gap-2 p-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
            <button
              onClick={() => onUpdateQuantity(deal.id, cartQuantity - 1)}
              className="w-7 h-7 rounded-md bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs hover:bg-slate-50 transition-colors"
              title="Odebrat 1 ks"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="text-center font-mono leading-tight">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{cartQuantity} ks v seznamu</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">≈ {formatCzk(cartQuantity * promoCzk)}</span>
            </div>
            <button
              onClick={() => onUpdateQuantity(deal.id, cartQuantity + 1)}
              className="w-7 h-7 rounded-md bg-emerald-700 text-white flex items-center justify-center shadow-xs hover:bg-emerald-800 transition-colors"
              title="Přidat 1 ks"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAddToCart(deal)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Do nákupního seznamu</span>
          </button>
        )}
      </div>
    </div>
  );
};
