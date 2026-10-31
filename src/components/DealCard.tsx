import React from 'react';
import { DealItem } from '../types';
import { STORES } from '../data/stores';
import { Plus, Minus, Check, ShieldCheck, AlertTriangle, AlertCircle, ExternalLink, HelpCircle } from 'lucide-react';

interface DealCardProps {
  deal: DealItem;
  exchangeRate: number;
  cartQuantity: number;
  onAddToCart: (deal: DealItem) => void;
  onUpdateQuantity: (dealId: string, quantity: number) => void;
  onOpenTrickModal: (deal: DealItem) => void;
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  exchangeRate,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onOpenTrickModal,
}) => {
  const store = STORES[deal.store];
  const promoCzk = deal.promoPricePln * exchangeRate;
  const regularCzk = deal.regularPricePln * exchangeRate;
  const savingsVsCzCzk = Math.max(0, deal.czechEquivalentCzk - promoCzk);
  const savingsVsCzPct = Math.round((savingsVsCzCzk / deal.czechEquivalentCzk) * 100);

  // Trick indicator style
  const getTrickBadge = () => {
    switch (deal.trickType) {
      case 'clean':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          label: 'Čistá sleva',
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'conditional_card':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          label: deal.requiredCard ? `Nutná ${deal.requiredCard}` : 'S aplikací',
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'trick_warning':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
          label: 'Pozor na podmínku',
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
    }
  };

  const trickBadge = getTrickBadge();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Card Header: Store & Flyer info */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase font-mono"
              style={{
                backgroundColor: deal.store === 'dino' ? '#b91c1c' : deal.store === 'biedronka' ? '#e10600' : deal.store === 'lidl' ? '#0050aa' : deal.store === 'kaufland' ? '#dc2626' : '#0284c7',
                color: '#ffffff',
              }}
            >
              {store.name}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
              Strana {deal.flyerPage} letáku
            </span>
          </div>

          <button
            onClick={() => onOpenTrickModal(deal)}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 font-medium"
            title="Zobrazit rozbor chytáku"
          >
            <span>Rozbor akce</span>
            <HelpCircle className="w-3 h-3" />
          </button>
        </div>

        {/* Product Visual Box */}
        <div className="p-4 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-800/20 dark:to-slate-900/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              {deal.polishTitle}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
              {deal.title}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>{deal.packageSize}</span>
              <span>·</span>
              <span>{deal.unit}</span>
            </div>
          </div>

          {/* Savings Badge */}
          {savingsVsCzPct > 0 && (
            <div className="text-right shrink-0">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block">
                Úspora vs ČR
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums leading-none block">
                -{savingsVsCzPct} %
              </span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                (ušetříte {Math.round(savingsVsCzCzk)} Kč)
              </span>
            </div>
          )}
        </div>

        {/* Pricing Comparison Module */}
        <div className="p-4 space-y-3">
          {/* Main Price Row */}
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  {deal.promoPricePln.toFixed(2)}
                  <span className="text-sm font-bold text-slate-500 ml-1">PLN</span>
                </span>
                <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                  {deal.regularPricePln.toFixed(2)} PLN
                </span>
              </div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 font-mono tabular-nums">
                ≈ {promoCzk.toFixed(1)} Kč{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">
                  (běžně v PL {regularCzk.toFixed(1)} Kč)
                </span>
              </div>
            </div>

            {/* Czech Reference Price */}
            <div className="text-right bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Běžně v Česku:</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono tabular-nums">
                ~{deal.czechEquivalentCzk.toFixed(0)} Kč
              </span>
            </div>
          </div>

          {/* Ojebometer Tag & Short Note */}
          <div className={`p-2.5 rounded-xl border ${trickBadge.bg} text-xs space-y-1`}>
            <div className="flex items-center gap-1.5 font-bold">
              {trickBadge.icon}
              <span>{deal.trickTitle}</span>
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed line-clamp-2">
              {deal.trickExplanation}
            </p>
            {deal.maxLimit && (
              <div className="text-[10px] font-mono font-medium pt-1 border-t border-black/5 dark:border-white/10 text-slate-600 dark:text-slate-300">
                ⚠️ {deal.maxLimit}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer: Add to Cart Action */}
      <div className="p-4 pt-0">
        {cartQuantity > 0 ? (
          <div className="flex items-center justify-between gap-2 p-1.5 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60">
            <button
              onClick={() => onUpdateQuantity(deal.id, cartQuantity - 1)}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 flex items-center justify-center shadow-xs hover:bg-slate-50 transition-colors"
              title="Odebrat 1 ks"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="text-center font-mono">
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                {cartQuantity} ks v seznamu
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                ≈ {(cartQuantity * promoCzk).toFixed(0)} Kč
              </span>
            </div>
            <button
              onClick={() => onUpdateQuantity(deal.id, cartQuantity + 1)}
              className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs hover:bg-red-700 transition-colors"
              title="Přidat 1 ks"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAddToCart(deal)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Přidat do nákupního seznamu</span>
          </button>
        )}
      </div>
    </div>
  );
};
