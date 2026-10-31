import React, { useState, useEffect, useMemo } from 'react';
import { StoreId, CategoryId, TrickType, DealItem, CartItem, CustomCartItem } from './types';
import { DEALS } from './data/deals';
import { STORES } from './data/stores';
import { Navbar } from './components/Navbar';
import { StoreFilterBar } from './components/StoreFilterBar';
import { FilterToolbar } from './components/FilterToolbar';
import { DealCard } from './components/DealCard';
import { DealDetailModal } from './components/DealDetailModal';
import { FlyerReaderModal } from './components/FlyerReaderModal';
import { ShoppingListDrawer } from './components/ShoppingListDrawer';
import { BorderShoppingGuide } from './components/BorderShoppingGuide';
import { ShieldAlert, Sparkles, TrendingUp, ShoppingBag, ArrowRight, HelpCircle } from 'lucide-react';

export default function App() {
  // Navigation & View tabs
  const [activeTab, setActiveTab] = useState<'deals' | 'flyers' | 'guide'>('deals');

  // Filters & Search
  const [selectedStore, setSelectedStore] = useState<StoreId | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [selectedTrickType, setSelectedTrickType] = useState<TrickType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'savings_pct' | 'price_asc' | 'discount_pln' | 'title'>('savings_pct');

  // Currency & Modals
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem('lovci_pln_rate');
    return saved ? parseFloat(saved) || 5.85 : 5.85;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('lovci_theme') === 'dark';
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTrickModalDeal, setActiveTrickModalDeal] = useState<DealItem | null>(null);

  // Cart & Custom items state with localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('lovci_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customItems, setCustomItems] = useState<CustomCartItem[]>(() => {
    try {
      const saved = localStorage.getItem('lovci_custom_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync exchange rate
  useEffect(() => {
    localStorage.setItem('lovci_pln_rate', exchangeRate.toString());
  }, [exchangeRate]);

  // Sync theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lovci_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lovci_theme', 'light');
    }
  }, [isDarkMode]);

  // Sync cart
  useEffect(() => {
    localStorage.setItem('lovci_cart', JSON.stringify(cart));
  }, [cart]);

  // Sync custom items
  useEffect(() => {
    localStorage.setItem('lovci_custom_items', JSON.stringify(customItems));
  }, [customItems]);

  // Dark mode toggle
  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Cart actions
  const handleAddToCart = (deal: DealItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.deal.id === deal.id);
      if (existing) {
        return prev.map((item) =>
          item.deal.id === deal.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { deal, quantity: deal.minQuantity && deal.minQuantity > 1 ? deal.minQuantity : 1 }];
    });
  };

  const handleUpdateQuantity = (dealId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(dealId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.deal.id === dealId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveItem = (dealId: string) => {
    setCart((prev) => prev.filter((item) => item.deal.id !== dealId));
  };

  const handleAddCustomItem = (title: string, pricePln: number) => {
    const newItem: CustomCartItem = {
      id: `custom-${Date.now()}`,
      title,
      estimatedPricePln: pricePln,
      quantity: 1,
    };
    setCustomItems((prev) => [...prev, newItem]);
  };

  const handleRemoveCustomItem = (id: string) => {
    setCustomItems((prev) => prev.filter((ci) => ci.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomItems([]);
  };

  // Cart summary calculations
  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0) + customItems.reduce((sum, i) => sum + i.quantity, 0);
  }, [cart, customItems]);

  const totalCartCzk = useMemo(() => {
    const dealsPln = cart.reduce((sum, item) => sum + item.deal.promoPricePln * item.quantity, 0);
    const customPln = customItems.reduce((sum, item) => sum + item.estimatedPricePln * item.quantity, 0);
    return (dealsPln + customPln) * exchangeRate;
  }, [cart, customItems, exchangeRate]);

  const totalSavedCzk = useMemo(() => {
    const dealsPln = cart.reduce((sum, item) => sum + item.deal.promoPricePln * item.quantity, 0);
    const dealsCzCzk = cart.reduce((sum, item) => sum + item.deal.czechEquivalentCzk * item.quantity, 0);
    return Math.max(0, dealsCzCzk - dealsPln * exchangeRate);
  }, [cart, exchangeRate]);

  // Filtered & sorted deals
  const filteredDeals = useMemo(() => {
    return DEALS.filter((deal) => {
      // Store filter
      if (selectedStore !== 'all' && deal.store !== selectedStore) return false;

      // Category filter
      if (selectedCategory !== 'all' && deal.category !== selectedCategory) return false;

      // Trick type filter
      if (selectedTrickType !== 'all' && deal.trickType !== selectedTrickType) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = deal.title.toLowerCase().includes(query);
        const matchesPolish = deal.polishTitle.toLowerCase().includes(query);
        const matchesStore = STORES[deal.store].name.toLowerCase().includes(query);
        const matchesExplanation = deal.trickExplanation.toLowerCase().includes(query);
        return matchesTitle || matchesPolish || matchesStore || matchesExplanation;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'savings_pct') {
        const aSaving = (a.czechEquivalentCzk - a.promoPricePln * exchangeRate) / a.czechEquivalentCzk;
        const bSaving = (b.czechEquivalentCzk - b.promoPricePln * exchangeRate) / b.czechEquivalentCzk;
        return bSaving - aSaving;
      }
      if (sortBy === 'price_asc') {
        return a.promoPricePln - b.promoPricePln;
      }
      if (sortBy === 'discount_pln') {
        const aDiscount = a.regularPricePln - a.promoPricePln;
        const bDiscount = b.regularPricePln - b.promoPricePln;
        return bDiscount - aDiscount;
      }
      return a.title.localeCompare(b.title, 'cs');
    });
  }, [selectedStore, selectedCategory, selectedTrickType, searchQuery, sortBy, exchangeRate]);

  // Deal counts by store
  const dealCountsByStore = useMemo(() => {
    const counts: Record<StoreId, number> = {
      biedronka: 0,
      dino: 0,
      lidl: 0,
      kaufland: 0,
      carrefour: 0,
    };
    DEALS.forEach((d) => {
      counts[d.store] = (counts[d.store] || 0) + 1;
    });
    return counts;
  }, []);

  const cartItemIds = useMemo(() => new Set(cart.map((c) => c.deal.id)), [cart]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-red-100 selection:text-red-900">
      {/* Top Bar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        exchangeRate={exchangeRate}
        setExchangeRate={setExchangeRate}
        cartCount={totalCartCount}
        cartTotalCzk={totalCartCzk}
        totalSavedCzk={totalSavedCzk}
        onOpenCart={() => setIsCartOpen(true)}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Section */}
        {activeTab === 'deals' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-red-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-red-950/20 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-red-600 dark:text-red-400 font-mono tracking-wider uppercase">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Nákupní watchdog pro české zákazníky</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  Polské akční letáky bez slevových chytáků
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sledujeme aktuální letáky <strong>Dino (marketdino.pl)</strong>, <strong>Biedronka</strong>, <strong>Lidl.pl</strong>, <strong>Kaufland.pl</strong> a <strong>Carrefour</strong>. Odhalujeme skryté podmínky věrnostních aplikací a počítáme reálnou úsporu v českých korunách.
                </p>
              </div>

              {/* Fast stats card */}
              <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Sledované řetězce:</span>
                  <strong className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">5 obchodů</strong>
                  <span className="text-[11px] text-slate-500 block">Dino, Biedronka...</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Běžná úspora:</span>
                  <strong className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">35 až 55 %</strong>
                  <span className="text-[11px] text-slate-500 block">oproti nákupu v ČR</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block font-medium">Aktuální kurz:</span>
                  <strong className="text-sm sm:text-base font-bold text-red-600 dark:text-red-400 font-mono">1 PLN = {exchangeRate} Kč</strong>
                  <span className="text-[11px] text-slate-500 block">živý přepočet cen</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Deals & Price Comparison */}
        {activeTab === 'deals' && (
          <div className="space-y-6">
            {/* Store switcher */}
            <StoreFilterBar
              selectedStore={selectedStore}
              onSelectStore={setSelectedStore}
              dealCountsByStore={dealCountsByStore}
            />

            {/* Filter and search toolbar */}
            <FilterToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedTrickType={selectedTrickType}
              onTrickTypeChange={setSelectedTrickType}
              sortBy={sortBy}
              onSortChange={setSortBy}
              resultsCount={filteredDeals.length}
            />

            {/* Deals Grid */}
            {filteredDeals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDeals.map((deal) => {
                  const cartItem = cart.find((i) => i.deal.id === deal.id);
                  const quantity = cartItem ? cartItem.quantity : 0;

                  return (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      exchangeRate={exchangeRate}
                      cartQuantity={quantity}
                      onAddToCart={handleAddToCart}
                      onUpdateQuantity={handleUpdateQuantity}
                      onOpenTrickModal={setActiveTrickModalDeal}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Žádné položky neodpovídají zvoleným filtrům
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Zkuste zrušit vyhledávací dotaz nebo vybrat jinou kategorii či typ slevy.
                </p>
                <button
                  onClick={() => {
                    setSelectedStore('all');
                    setSelectedCategory('all');
                    setSelectedTrickType('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold"
                >
                  Resetovat všechny filtry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Interactive Flyer Reader */}
        {activeTab === 'flyers' && (
          <FlyerReaderModal
            initialStore={selectedStore === 'all' ? 'dino' : selectedStore}
            exchangeRate={exchangeRate}
            onAddToCart={handleAddToCart}
            cartItemIds={cartItemIds}
          />
        )}

        {/* Tab 3: Cross-border Shopper Guide */}
        {activeTab === 'guide' && <BorderShoppingGuide />}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-slate-800 dark:text-white">LovciSlev PL</span> · Nezávislý srovnávač polských akčních letáků a hlídač chytáků pro české nakupující.
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Sledujeme: Biedronka · Dino · Lidl · Kaufland · Carrefour</span>
            <span>·</span>
            <span>Kurz: 1 PLN = {exchangeRate} Kč</span>
          </div>
        </div>
      </footer>

      {/* Modals & Slide-overs */}
      <DealDetailModal
        deal={activeTrickModalDeal}
        exchangeRate={exchangeRate}
        isOpen={!!activeTrickModalDeal}
        onClose={() => setActiveTrickModalDeal(null)}
        onAddToCart={handleAddToCart}
        isInCart={activeTrickModalDeal ? cartItemIds.has(activeTrickModalDeal.id) : false}
      />

      <ShoppingListDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        customItems={customItems}
        exchangeRate={exchangeRate}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onAddCustomItem={handleAddCustomItem}
        onRemoveCustomItem={handleRemoveCustomItem}
        onClearCart={handleClearCart}
      />
    </div>
  );
}
