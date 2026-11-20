import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { copyText, whatsappUrl, smsUrl, nativeShare, canNativeShare } from '../utils/share';
import { formatNum2 } from '../utils/format';
import { linePrice } from '../utils/pricing';
import { CartItem, CustomCartItem, StoreId } from '../types';
import { STORES } from '../data/stores';
import { X, Plus, Minus, Trash2, Copy, Check, ShoppingBag, Smartphone, MessageCircle, MessageSquare, Share2, AlertTriangle, Printer, ListChecks } from 'lucide-react';

const KEEP_URL = 'https://keep.google.com/';

/** Phone or tablet: the share sheet offers Google Keep directly. */
const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function itemsLabel(n: number): string {
  return `${n} ${n === 1 ? 'položka' : n >= 2 && n <= 4 ? 'položky' : 'položek'}`;
}

interface ShoppingListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  customItems: CustomCartItem[];
  exchangeRate: number;
  onUpdateQuantity: (dealId: string, quantity: number) => void;
  onRemoveItem: (dealId: string) => void;
  onAddCustomItem: (title: string, pricePln: number) => void;
  onRemoveCustomItem: (id: string) => void;
  onClearCart: () => void;
}

export const ShoppingListDrawer: React.FC<ShoppingListDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  customItems,
  exchangeRate,
  onUpdateQuantity,
  onRemoveItem,
  onAddCustomItem,
  onRemoveCustomItem,
  onClearCart,
}) => {
  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newCustomPrice, setNewCustomPrice] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);
  const [keepHint, setKeepHint] = useState<'copied' | 'manual' | null>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  // Totals calculation – each line priced by its conditions (min. quantity, limit, bundles)
  const lines = new Map(cart.map((item) => [item.deal.id, linePrice(item.deal, item.quantity)]));
  const lineOf = (id: string) => lines.get(id)!;
  const dealsTotalPln = cart.reduce((sum, item) => sum + lineOf(item.deal.id).totalPln, 0);
  const linesWithNotes = cart.filter((item) => lineOf(item.deal.id).notes.length > 0).length;
  const customTotalPln = customItems.reduce((sum, item) => sum + item.estimatedPricePln * item.quantity, 0);
  const totalPln = dealsTotalPln + customTotalPln;
  const totalCzk = totalPln * exchangeRate;

  // Savings vs Czech equivalent – only for items that have a Czech reference price
  const czPriced = cart.filter((item) => item.deal.czechEquivalentCzk > 0);
  const dealsTotalCzCzk = czPriced.reduce((sum, item) => sum + item.deal.czechEquivalentCzk * item.quantity, 0);
  const czPricedPln = czPriced.reduce((sum, item) => sum + lineOf(item.deal.id).totalPln, 0);
  const totalSavedCzk = Math.max(0, dealsTotalCzCzk - czPricedPln * exchangeRate);
  const totalSavedPct = dealsTotalCzCzk > 0 ? Math.round((totalSavedCzk / dealsTotalCzCzk) * 100) : 0;

  // Determine needed loyalty apps
  const storesInCart = new Set<StoreId>();
  cart.forEach((i) => storesInCart.add(i.deal.store));

  const neededApps: { storeName: string; appName: string | null; tip: string }[] = [];
  storesInCart.forEach((sid) => {
    const s = STORES[sid];
    neededApps.push({
      storeName: s.name,
      appName: s.loyaltyCardName,
      tip: s.borderShopperTip,
    });
  });

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomTitle.trim()) return;
    const price = parseFloat(newCustomPrice) || 0;
    onAddCustomItem(newCustomTitle.trim(), price);
    setNewCustomTitle('');
    setNewCustomPrice('');
  };

  const buildShoppingListText = (): string => {
    let text = `🛒 NÁKUPNÍ SEZNAM DO POLSKA (lovec-slev.cz)\n`;
    text += `Kurz: 1 zł = ${formatNum2(exchangeRate)} Kč\n\n`;

    if (cart.length > 0) {
      text += `--- POLOŽKY Z LETÁKŮ ---\n`;
      cart.forEach((item) => {
        const line = lineOf(item.deal.id);
        const itemCzk = line.totalPln * exchangeRate;
        text += `[ ] ${item.quantity}x ${item.deal.title} (${STORES[item.deal.store].name})\n`;
        text += `    Cena: ${formatNum2(line.totalPln)} zł (≈ ${itemCzk.toFixed(0)} Kč)\n`;
        if (item.deal.trickType !== 'clean') {
          text += `    ⚠️ PODMÍNKA: ${item.deal.trickTitle}\n`;
        }
        line.notes.forEach((n) => {
          text += `    ⚠️ ${n}\n`;
        });
      });
      text += `\n`;
    }

    if (customItems.length > 0) {
      text += `--- VLASTNÍ POLOŽKY ---\n`;
      customItems.forEach((ci) => {
        text += `[ ] ${ci.quantity}x ${ci.title} (~${formatNum2(ci.estimatedPricePln)} zł)\n`;
      });
      text += `\n`;
    }

    text += `-------------------------\n`;
    text += `CELKEM: ${formatNum2(totalPln)} zł (cca ${Math.round(totalCzk)} Kč)\n`;
    if (totalSavedCzk > 0) {
      text += `ÚSPORA PROTI AKCÍM V ČR (orientačně, ojeb.cz): ${Math.round(totalSavedCzk)} Kč (-${totalSavedPct} %)\n\n`;
    }

    if (neededApps.length > 0) {
      text += `📱 POTŘEBNÉ APLIKACE DO MOBILU:\n`;
      neededApps.forEach((a) => {
        if (a.appName) {
          text += `• ${a.storeName}: ${a.appName}\n`;
        } else {
          text += `• ${a.storeName}: bez karty / aplikace\n`;
        }
      });
    }

    return text;
  };

  const handleCopyShoppingList = async () => {
    const text = buildShoppingListText();
    if (await copyText(text)) {
      setManualCopyText(null);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } else {
      // Browser refused: show the text selected so the user can copy it by hand.
      setManualCopyText(text);
      setTimeout(() => manualRef.current?.select(), 50);
    }
  };

  // Items sorted by store – the order you walk the shops in
  const cartByStore = [...cart].sort((a, b) => STORES[a.deal.store].name.localeCompare(STORES[b.deal.store].name, 'cs'));

  /**
   * One line per item, nothing else: Google Keep turns every line into a
   * checkbox ("Zobrazit zaškrtávací políčka"), so totals and headers stay out.
   */
  const buildKeepText = (): string => {
    const lines = cartByStore.map(({ deal, quantity }) => {
      const line = lineOf(deal.id);
      const cond: string[] = [];
      if (deal.requiredCard) cond.push(`s ${deal.requiredCard}`);
      if (deal.minQuantity && deal.minQuantity > 1) cond.push(`od ${deal.minQuantity} ks`);
      if (deal.maxQuantity) cond.push(`max. ${deal.maxQuantity} ks`);
      const extra = cond.length ? ` (${cond.join(', ')})` : '';
      return `${quantity}× ${deal.title} – ${STORES[deal.store].name} – ${formatNum2(line.totalPln)} zł${extra}`;
    });
    customItems.forEach((ci) => {
      const price = ci.estimatedPricePln > 0 ? ` – ~${formatNum2(ci.estimatedPricePln * ci.quantity)} zł` : '';
      lines.push(`${ci.quantity}× ${ci.title}${price}`);
    });
    return lines.join('\n');
  };

  const keepTitle = `Nákup v Polsku – ${formatNum2(totalPln)} zł (≈ ${Math.round(totalCzk)} Kč)`;

  const handleKeep = async () => {
    const text = buildKeepText();
    // Phones: the system share sheet lists Keep; the title becomes the note title.
    if (isTouchDevice() && canNativeShare()) {
      await nativeShare(text, keepTitle);
      return;
    }
    // Desktop: Keep has no public "create note" link – copy and open Keep.
    if (await copyText(text)) {
      setKeepHint('copied');
    } else {
      setManualCopyText(text);
      setKeepHint('manual');
      setTimeout(() => manualRef.current?.select(), 50);
    }
    window.open(KEEP_URL, '_blank', 'noopener');
  };

  const handlePrint = () => {
    setKeepHint(null);
    window.print();
  };

  const handleShare = async () => {
    if (!(await nativeShare(buildShoppingListText(), 'Nákupní seznam – Lovec slev'))) await handleCopyShoppingList();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Chytrý nákupní seznam do Polska
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {itemsLabel(cart.length + customItems.length)} · Kurz 1 PLN = {exchangeRate} Kč
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
            aria-label="Zavřít seznam"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Celkový nákup:</span>
              <div className="text-2xl font-black font-mono tabular-nums">
                {totalPln.toFixed(2)} <span className="text-sm font-normal text-slate-300">PLN</span>
              </div>
              <div className="text-xs font-bold text-red-400 font-mono mt-0.5">
                ≈ {Math.round(totalCzk)} Kč
              </div>
              {linesWithNotes > 0 && (
                <div className="text-[11px] text-amber-300 mt-1">
                  Počítáno včetně podmínek akcí ({linesWithNotes}× část za běžnou cenu)
                </div>
              )}
            </div>

            {dealsTotalCzCzk > 0 && (
            <div className="border-l border-white/10 pl-4">
              <span className="text-xs text-emerald-400 block font-medium">
                Proti akcím v ČR{czPriced.length < cart.length ? ` (${czPriced.length} z ${cart.length} položek)` : ''}:
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                +{Math.round(totalSavedCzk)} <span className="text-sm font-normal">Kč</span>
              </div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">
                orientačně −{totalSavedPct} % · zdroj ojeb.cz
              </div>
            </div>
            )}
          </div>

          {/* Loyalty App Checklist Alert */}
          {neededApps.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <Smartphone className="w-4 h-4 text-amber-600" />
                <span>Nezapomeňte si připravit aplikace do mobilu:</span>
              </div>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                {neededApps.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                      • {a.storeName}:
                    </span>
                    <span>
                      {a.appName ? (
                        <>Mějte nainstalovanou <strong>{a.appName}</strong> ({a.tip})</>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Žádná karta není potřeba (slevy pro každého)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deals items list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Akční zboží z letáků ({cart.length})</span>
              {cart.length > 0 && (
                <button
                  onClick={onClearCart}
                  className="text-rose-600 hover:text-rose-700 text-[11px] font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Vymazat vše
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                Zatím jste nepřidali žádné zboží z letáku. Klikněte na "Přidat do nákupního seznamu" u libovolného produktu.
              </div>
            ) : (
              <div className="space-y-2.5">
                {cart.map(({ deal, quantity }) => {
                  const line = lineOf(deal.id);
                  const itemPln = line.totalPln;
                  const itemCzk = itemPln * exchangeRate;
                  const store = STORES[deal.store];

                  return (
                    <div
                      key={deal.id}
                      className={`p-3 rounded-2xl border bg-white dark:bg-slate-800/80 shadow-2xs text-xs ${
                        line.notes.length ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded text-white font-mono uppercase"
                            style={{
                              backgroundColor: deal.store === 'dino' ? '#b91c1c' : deal.store === 'biedronka' ? '#e10600' : deal.store === 'lidl' ? '#0050aa' : deal.store === 'kaufland' ? '#dc2626' : '#0284c7',
                            }}
                          >
                            {store.name}
                          </span>
                          {deal.trickType !== 'clean' && (
                            <span className="text-[10px] text-amber-800 dark:text-amber-400 font-medium truncate max-w-[200px]">
                              ⚠️ {deal.trickTitle}
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {deal.title}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 font-mono">
                          {deal.promoPricePln.toFixed(2)} PLN/ks ≈ {(deal.promoPricePln * exchangeRate).toFixed(1)} Kč
                          {deal.minQuantity && deal.minQuantity > 1 ? ` · od ${deal.minQuantity} ks` : ''}
                          {deal.maxQuantity ? ` · max. ${deal.maxQuantity} ks` : ''}
                        </div>
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                        <button
                          onClick={() => onUpdateQuantity(deal.id, quantity - 1)}
                          aria-label="Ubrat 1 ks"
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold font-mono text-slate-900 dark:text-white">
                          {quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(deal.id, quantity + 1)}
                          aria-label="Přidat 1 ks"
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price total for item */}
                      <div className="text-right shrink-0 min-w-[70px]">
                        <div className="font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                          {itemPln.toFixed(2)} PLN
                        </div>
                        <div className="text-[11px] text-red-600 dark:text-red-400 font-mono">
                          ≈ {Math.round(itemCzk)} Kč
                        </div>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemoveItem(deal.id)}
                        className="text-slate-500 hover:text-rose-600 w-8 h-8 flex items-center justify-center transition-colors"
                        title="Odstranit"
                        aria-label={`Odstranit ${deal.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {line.notes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                        <span className="flex-1 min-w-[12rem]">{line.notes.join(' · ')}</span>
                        {line.suggestedQuantity && (
                          <button
                            onClick={() => onUpdateQuantity(deal.id, line.suggestedQuantity!)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900 font-semibold"
                          >
                            Doplnit na {line.suggestedQuantity} ks
                          </button>
                        )}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom items list */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Vlastní poznámky & další nákup ({customItems.length})
            </div>

            {customItems.length > 0 && (
              <div className="space-y-2">
                {customItems.map((ci) => (
                  <div
                    key={ci.id}
                    className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {ci.quantity}x {ci.title}
                    </span>
                    {ci.estimatedPricePln > 0 && (
                      <span className="font-mono text-slate-500">
                        ~{(ci.estimatedPricePln * ci.quantity).toFixed(2)} PLN (≈ {Math.round(ci.estimatedPricePln * ci.quantity * exchangeRate)} Kč)
                      </span>
                    )}
                    <button
                      onClick={() => onRemoveCustomItem(ci.id)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom item form */}
            <form onSubmit={handleAddCustom} className="flex gap-2">
              <input
                type="text"
                value={newCustomTitle}
                onChange={(e) => setNewCustomTitle(e.target.value)}
                placeholder="Např. Krovky, polévka Žurek, palivo PB95..."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
              />
              <input
                type="number"
                step="0.1"
                value={newCustomPrice}
                onChange={(e) => setNewCustomPrice(e.target.value)}
                placeholder="PLN (volitelné)"
                className="w-24 px-2 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 text-center font-mono"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shrink-0"
              >
                + Přidat
              </button>
            </form>
          </div>
        </div>

        {keepHint && (
          <div role="status" className="px-5 py-3 border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <ListChecks className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <strong>{keepHint === 'copied' ? 'Seznam je zkopírovaný.' : 'Zkopírujte seznam níže.'}</strong> V Google Keep
              (otevřel se v nové kartě) založte poznámku, vložte text (Ctrl+V) a v nabídce ⋮ zvolte{' '}
              <em>Zobrazit zaškrtávací políčka</em> – každý řádek bude jedna položka k odškrtnutí.{' '}
              <a href={KEEP_URL} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                Otevřít Keep
              </a>
            </div>
            <button onClick={() => setKeepHint(null)} className="text-slate-500 hover:text-slate-800" aria-label="Zavřít nápovědu">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Manual copy fallback when the browser blocks the clipboard */}
        {manualCopyText && (
          <div className="px-5 pt-4 border-t border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Prohlížeč nepovolil automatické kopírování – text je označený, zkopírujte ho (Ctrl+C / podržet prst).
              </span>
              <button onClick={() => setManualCopyText(null)} className="text-slate-500 hover:text-slate-800" title="Zavřít">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              ref={manualRef}
              readOnly
              value={manualCopyText}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-40 mb-4 p-2 text-xs font-mono rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>
        )}

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono text-center sm:text-left">
            Celkem k platbě: <strong className="text-slate-900 dark:text-white text-sm">{totalPln.toFixed(2)} PLN</strong> (≈ {Math.round(totalCzk)} Kč)
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyShoppingList}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all"
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Zkopírováno do schránky!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Kopírovat</span>
                </>
              )}
            </button>
            <button
              onClick={handleKeep}
              disabled={cart.length + customItems.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-bold transition-all disabled:opacity-50"
              title="Odškrtávací seznam v Google Keep"
            >
              <ListChecks className="w-4 h-4" />
              <span>Google Keep</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={cart.length + customItems.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
              title="Vytisknout seznam se zaškrtávacími políčky"
            >
              <Printer className="w-4 h-4" />
              <span>Tisk</span>
            </button>
            <a
              href={whatsappUrl(buildShoppingListText())}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all"
              title="Otevře WhatsApp s připraveným seznamem"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
            <a
              href={smsUrl(buildShoppingListText())}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition-all"
              title="Otevře SMS s připraveným seznamem (v mobilu)"
            >
              <MessageSquare className="w-4 h-4" />
              <span>SMS</span>
            </a>
            {canNativeShare() && (
              <button
                onClick={handleShare}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
                title="Sdílet přes jinou aplikaci"
              >
                <Share2 className="w-4 h-4" />
                <span>Sdílet</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Printable list – hidden on screen, the only thing on paper */}
      {createPortal(
        <div className="print-only" lang="cs">
          <h1>Nákupní seznam do Polska</h1>
          <p className="print-meta">
            lovec-slev.cz · vytištěno {new Date().toLocaleDateString('cs-CZ')} · kurz 1 zł = {formatNum2(exchangeRate)} Kč
          </p>
          {(Object.keys(STORES) as StoreId[])
            .filter((sid) => cart.some((i) => i.deal.store === sid))
            .map((sid) => (
              <section key={sid}>
                <h2>
                  {STORES[sid].name}
                  {STORES[sid].loyaltyCardName && cart.some((i) => i.deal.store === sid && i.deal.requiredCard)
                    ? ` – vzít ${STORES[sid].loyaltyCardName}`
                    : ''}
                </h2>
                <ul>
                  {cart
                    .filter((i) => i.deal.store === sid)
                    .map(({ deal, quantity }) => {
                      const line = lineOf(deal.id);
                      return (
                        <li key={deal.id}>
                          <span className="box" aria-hidden="true" />
                          <span className="qty">{quantity}×</span>
                          <span className="name">
                            {deal.title}
                            {deal.packageSize && <small> {deal.packageSize}</small>}
                            {(deal.requiredCard || line.notes.length > 0 || (deal.minQuantity ?? 0) > 1) && (
                              <small className="cond">
                                {[
                                  deal.requiredCard ? `jen s ${deal.requiredCard}` : '',
                                  (deal.minQuantity ?? 0) > 1 ? `akce od ${deal.minQuantity} ks` : '',
                                  deal.maxQuantity ? `max. ${deal.maxQuantity} ks` : '',
                                  ...line.notes,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </small>
                            )}
                          </span>
                          <span className="price">
                            {formatNum2(line.totalPln)} zł
                            <small>≈ {Math.round(line.totalPln * exchangeRate)} Kč</small>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
          {customItems.length > 0 && (
            <section>
              <h2>Další nákup</h2>
              <ul>
                {customItems.map((ci) => (
                  <li key={ci.id}>
                    <span className="box" aria-hidden="true" />
                    <span className="qty">{ci.quantity}×</span>
                    <span className="name">{ci.title}</span>
                    <span className="price">
                      {ci.estimatedPricePln > 0 ? `~${formatNum2(ci.estimatedPricePln * ci.quantity)} zł` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="print-total">
            Celkem: {formatNum2(totalPln)} zł (≈ {Math.round(totalCzk)} Kč)
          </p>
          <p className="print-meta">Na terminálu plaťte v PLN (zlotých), ne v Kč.</p>
        </div>,
        document.body
      )}
    </div>
  );
};
