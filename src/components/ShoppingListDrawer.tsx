import React, { useState } from 'react';
import { CartItem, CustomCartItem, StoreId } from '../types';
import { STORES } from '../data/stores';
import { X, Plus, Minus, Trash2, Copy, Check, ShoppingBag, Smartphone, ShieldCheck, Sparkles } from 'lucide-react';

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

  if (!isOpen) return null;

  // Totals calculation
  const dealsTotalPln = cart.reduce((sum, item) => sum + item.deal.promoPricePln * item.quantity, 0);
  const customTotalPln = customItems.reduce((sum, item) => sum + item.estimatedPricePln * item.quantity, 0);
  const totalPln = dealsTotalPln + customTotalPln;
  const totalCzk = totalPln * exchangeRate;

  // Savings calculation vs Czech equivalent
  const dealsTotalCzCzk = cart.reduce((sum, item) => sum + item.deal.czechEquivalentCzk * item.quantity, 0);
  const totalSavedCzk = Math.max(0, dealsTotalCzCzk - dealsTotalPln * exchangeRate);
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

  const handleCopyShoppingList = () => {
    let text = `🛒 NÁKUPNÍ SEZNAM DO POLSKA (lovec-slev.cz)\n`;
    text += `Kurz: 1 PLN = ${exchangeRate.toFixed(2)} Kč\n\n`;

    if (cart.length > 0) {
      text += `--- POLOŽKY Z LETÁKŮ ---\n`;
      cart.forEach((item) => {
        const itemCzk = item.deal.promoPricePln * exchangeRate * item.quantity;
        text += `[ ] ${item.quantity}x ${item.deal.title} (${STORES[item.deal.store].name})\n`;
        text += `    Cena: ${(item.deal.promoPricePln * item.quantity).toFixed(2)} PLN (≈ ${itemCzk.toFixed(0)} Kč)\n`;
        if (item.deal.trickType !== 'clean') {
          text += `    ⚠️ PODMÍNKA: ${item.deal.trickTitle}\n`;
        }
      });
      text += `\n`;
    }

    if (customItems.length > 0) {
      text += `--- VLASTNÍ POLOŽKY ---\n`;
      customItems.forEach((ci) => {
        text += `[ ] ${ci.quantity}x ${ci.title} (~${ci.estimatedPricePln.toFixed(2)} PLN)\n`;
      });
      text += `\n`;
    }

    text += `-------------------------\n`;
    text += `CELKEM: ${totalPln.toFixed(2)} PLN (cca ${Math.round(totalCzk)} Kč)\n`;
    if (totalSavedCzk > 0) {
      text += `ODHADOVANÁ ÚSPORA OPROTI ČR: ${Math.round(totalSavedCzk)} Kč (-${totalSavedPct} %)\n\n`;
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

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
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
                {cart.length + customItems.length} položek · Kurz 1 PLN = {exchangeRate} Kč
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
            </div>

            {dealsTotalCzCzk > 0 && (
            <div className="border-l border-white/10 pl-4">
              <span className="text-xs text-emerald-400 block font-medium">Úspora vs nákup v ČR:</span>
              <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                +{Math.round(totalSavedCzk)} <span className="text-sm font-normal">Kč</span>
              </div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">
                Ušetříte cca {totalSavedPct} % rozpočtu
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
                  const itemPln = deal.promoPricePln * quantity;
                  const itemCzk = itemPln * exchangeRate;
                  const store = STORES[deal.store];

                  return (
                    <div
                      key={deal.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-2xs flex items-center justify-between gap-3 text-xs"
                    >
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
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate max-w-[200px]">
                              ⚠️ {deal.trickTitle}
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {deal.title}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono">
                          {deal.promoPricePln.toFixed(2)} PLN/ks ≈ {(deal.promoPricePln * exchangeRate).toFixed(1)} Kč
                        </div>
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                        <button
                          onClick={() => onUpdateQuantity(deal.id, quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold font-mono text-slate-900 dark:text-white">
                          {quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(deal.id, quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors"
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
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Odstranit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono text-center sm:text-left">
            Celkem k platbě: <strong className="text-slate-900 dark:text-white text-sm">{totalPln.toFixed(2)} PLN</strong> (≈ {Math.round(totalCzk)} Kč)
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
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
                  <span>Kopírovat pro WhatsApp / SMS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
