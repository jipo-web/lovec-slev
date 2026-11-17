import React, { useState, useEffect, useMemo } from 'react';
import { LogoMark } from './components/Logo';
import { StoreId, CategoryId, TrickType, DealItem, CartItem, CustomCartItem, SortKey, Verdict } from './types';
import { DEALS } from './data/deals';
import { loadOffers, loadLeaflets, offerToDealItem, PipelineLeaflet } from './data/loadData';
import { STORES } from './data/stores';
import { Navbar } from './components/Navbar';
import { StoreFilterBar } from './components/StoreFilterBar';
import { FilterToolbar } from './components/FilterToolbar';
import { DealCard } from './components/DealCard';
import { DealDetailModal } from './components/DealDetailModal';
import { FlyerReaderModal } from './components/FlyerReaderModal';
import { DayPicker, toIsoDay } from './components/DayPicker';
import { LeafletGrid } from './components/LeafletGrid';
import { LeafletPager } from './components/LeafletPager';
import { ShoppingListDrawer } from './components/ShoppingListDrawer';
import { BorderShoppingGuide } from './components/BorderShoppingGuide';
import { ShieldAlert, HelpCircle, Flame } from 'lucide-react';
import { discountPct, MIN_VISIBLE_DISCOUNT_PCT } from './utils/format';

export default function App() {
  // Navigation & View tabs
  const [activeTab, setActiveTab] = useState<'deals' | 'flyers' | 'guide'>('deals');

  // Filters & Search
  const [selectedStore, setSelectedStore] = useState<StoreId | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [selectedTrickType, setSelectedTrickType] = useState<TrickType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('savings_pct');
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | 'all'>('all');
  const [selectedDay, setSelectedDay] = useState<string>(() => toIsoDay(new Date()));

  // Data source: pipeline JSON with mock fallback
  const [allDeals, setAllDeals] = useState<DealItem[]>(DEALS);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [leaflets, setLeaflets] = useState<PipelineLeaflet[] | null>(null);

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
  const [flyerPageView, setFlyerPageView] = useState<{ leaflet: PipelineLeaflet; page: number } | null>(null);

  // Logo click: back to the default homepage state
  const handleGoHome = () => {
    setActiveTab('deals');
    setSelectedStore('all');
    setSelectedCategory('all');
    setSelectedTrickType('all');
    setSelectedVerdict('all');
    setSearchQuery('');
    setSortBy('savings_pct');
    setSelectedDay(toIsoDay(new Date()));
    setActiveTrickModalDeal(null);
    setFlyerPageView(null);
    setIsCartOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open the flyer page a deal comes from (from the deal card header)
  // "Strana N" = position of the offer's own page image in the leaflet's current
  // list. Stores reorder pages and insert ads, so the stored page_no can drift.
  useEffect(() => {
    if (!leaflets?.length) return;
    const pos = new Map<string, number>();
    leaflets.forEach((lf) => lf.page_image_urls.forEach((u, i) => pos.set(u, i + 1)));
    setAllDeals((prev) => {
      let changed = false;
      const next = prev.map((d) => {
        const p = d.pageImageUrl ? pos.get(d.pageImageUrl) : undefined;
        if (p && p !== d.flyerPage) {
          changed = true;
          return { ...d, flyerPage: p };
        }
        return d;
      });
      return changed ? next : prev;
    });
  }, [leaflets, allDeals]);

  const handleOpenFlyerPage = (deal: DealItem) => {
    const leaflet = leaflets?.find((lf) => lf.id === deal.leafletId);
    const idx = leaflet && deal.pageImageUrl ? leaflet.page_image_urls.indexOf(deal.pageImageUrl) : -1;
    if (leaflet && idx >= 0) {
      setFlyerPageView({ leaflet, page: idx + 1 });
      return;
    }
    if (deal.pageImageUrl) {
      // No leaflet record, but the offer carries its own page image
      setFlyerPageView({
        leaflet: {
          id: deal.leafletId ?? deal.id,
          store: deal.store,
          title: deal.flyerName,
          valid_from: deal.validFrom,
          valid_to: deal.validUntil,
          source_url: STORES[deal.store].website,
          pdf_url: null,
          pages: 1,
          thumbnail_url: null,
          page_image_urls: [deal.pageImageUrl],
          offer_count: 1,
          is_food: true,
        },
        page: 1,
      });
      return;
    }
    // Mock data without page images: at least switch to the flyers tab
    setSelectedStore(deal.store);
    setActiveTab('flyers');
  };

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

  // Load real data from the pipeline (falls back to mock DEALS)
  useEffect(() => {
    let cancelled = false;
    loadOffers().then((file) => {
      if (cancelled || !file || !file.offers || file.offers.length === 0) return;
      setAllDeals(file.offers.map((o) => offerToDealItem(o, file.rate_czk_per_pln)));
      setGeneratedAt(file.generated_at);
      if (file.rate_czk_per_pln > 0 && localStorage.getItem('lovci_pln_rate') === null) {
        setExchangeRate(file.rate_czk_per_pln);
      }
      setSortBy(file.offers.some((o) => o.verdict) ? 'score' : 'savings_pct');
    });
    loadLeaflets().then((file) => {
      if (cancelled || !file || !file.leaflets || file.leaflets.length === 0) return;
      setLeaflets(file.leaflets);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasVerdicts = useMemo(() => allDeals.some((d) => d.verdict), [allDeals]);

  // Persist exchange rate only when the user changes it manually,
  // so the pipeline rate is not frozen as a "custom" rate.
  const handleSetExchangeRate = (rate: number) => {
    setExchangeRate(rate);
    localStorage.setItem('lovci_pln_rate', rate.toString());
  };

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
    return allDeals.filter((deal) => {
      // Day filter (ISO date strings compare lexicographically)
      // (only for real pipeline data; mock deals have outdated validity)
      if (generatedAt && (deal.validFrom > selectedDay || deal.validUntil < selectedDay)) return false;

      // Store filter
      if (selectedStore !== 'all' && deal.store !== selectedStore) return false;

      // Category filter
      if (selectedCategory !== 'all' && deal.category !== selectedCategory) return false;

      // Trick type filter
      if (selectedTrickType !== 'all' && deal.trickType !== selectedTrickType) return false;

      // Verdict filter
      if (selectedVerdict !== 'all' && deal.verdict !== selectedVerdict) return false;

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
      if (sortBy === 'score') {
        return (b.score ?? -Infinity) - (a.score ?? -Infinity);
      }
      if (sortBy === 'savings_pct') {
        const saving = (d: DealItem) =>
          d.czechEquivalentCzk > 0 ? (d.czechEquivalentCzk - d.promoPricePln * exchangeRate) / d.czechEquivalentCzk : -Infinity;
        const aSaving = saving(a);
        const bSaving = saving(b);
        if (aSaving === bSaving) return b.regularPricePln - b.promoPricePln - (a.regularPricePln - a.promoPricePln);
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
      return a.title.localeCompare(b.title, 'pl');
    });
  }, [allDeals, generatedAt, selectedDay, selectedStore, selectedCategory, selectedTrickType, selectedVerdict, searchQuery, sortBy, exchangeRate]);

  // Deal counts by store
  const dealCountsByStore = useMemo(() => {
    const counts: Record<StoreId, number> = {
      biedronka: 0,
      dino: 0,
      lidl: 0,
      kaufland: 0,
    };
    allDeals.forEach((d) => {
      counts[d.store] = (counts[d.store] || 0) + 1;
    });
    return counts;
  }, [allDeals]);

  const cartItemIds = useMemo(() => new Set(cart.map((c) => c.deal.id)), [cart]);

  // Deals valid on the selected day (before store/category/search filters)
  const dealsForDay = useMemo(
    () => allDeals.filter((d) => !generatedAt || (d.validFrom <= selectedDay && d.validUntil >= selectedDay)),
    [allDeals, generatedAt, selectedDay]
  );

  // Hero statistics computed from real data instead of hard-coded marketing numbers
  const heroStats = useMemo(() => {
    const stores = new Set(dealsForDay.map((d) => d.store)).size;
    const discounts = dealsForDay
      .map((d) => discountPct(d.promoPricePln, d.regularPricePln))
      .filter((p): p is number => p != null && p >= MIN_VISIBLE_DISCOUNT_PCT)
      .sort((a, b) => a - b);
    const median = discounts.length ? discounts[Math.floor(discounts.length / 2)] : 0;
    const trhaky = dealsForDay.filter((d) => d.verdict === 'trhak').length;
    return { offers: dealsForDay.length, stores, medianDiscount: Math.round(median), trhaky };
  }, [dealsForDay]);

  // Top 6 discounts across stores (max 2 per store so one chain cannot fill the strip)
  const topDeals = useMemo(() => {
    const perStore: Record<string, number> = {};
    const picked: DealItem[] = [];
    const ranked = dealsForDay
      .map((d) => ({ d, pct: discountPct(d.promoPricePln, d.regularPricePln) ?? 0 }))
      // Skip traps, multi-buy tricks ("2nd for 1 zł") and implausible >80 % cuts
      // (those are usually a unit price parsed as the old price).
      .filter(
        (x) =>
          x.pct >= MIN_VISIBLE_DISCOUNT_PCT &&
          x.pct <= 80 &&
          x.d.verdict !== 'past' &&
          x.d.trickType !== 'trick_warning'
      )
      .sort((a, b) => b.pct - a.pct);
    for (const { d } of ranked) {
      if ((perStore[d.store] ?? 0) >= 2) continue;
      perStore[d.store] = (perStore[d.store] ?? 0) + 1;
      picked.push(d);
      if (picked.length === 6) break;
    }
    return picked;
  }, [dealsForDay]);
  const topDealIds = useMemo(() => new Set(topDeals.map((d) => d.id)), [topDeals]);
  const showTopDeals =
    activeTab === 'deals' &&
    topDeals.length > 0 &&
    selectedStore === 'all' &&
    selectedCategory === 'all' &&
    selectedTrickType === 'all' &&
    selectedVerdict === 'all' &&
    !searchQuery.trim();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-red-100 selection:text-red-900">
      {/* Top Bar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onGoHome={handleGoHome}
        exchangeRate={exchangeRate}
        setExchangeRate={handleSetExchangeRate}
        cartCount={totalCartCount}
        cartTotalCzk={totalCartCzk}
        totalSavedCzk={totalSavedCzk}
        onOpenCart={() => setIsCartOpen(true)}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Section – one compact row */}
        {activeTab === 'deals' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-white via-slate-50 to-red-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-red-950/20 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-red-600 dark:text-red-400 font-mono tracking-wider uppercase">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Nákupní watchdog pro české zákazníky</span>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Polské akční letáky bez slevových chytáků
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Biedronka, Lidl.pl, Kaufland.pl a Dino – podmínky věrnostních karet odhalené, ceny přepočtené na koruny.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-4 shrink-0 text-center">
              <div>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">{heroStats.offers}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">nabídek dnes</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">{heroStats.stores}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">řetězce</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {heroStats.medianDiscount > 0 ? `-${heroStats.medianDiscount} %` : '–'}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">typická sleva</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400 font-mono tabular-nums">{exchangeRate}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">Kč / 1 zł</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Deals & Price Comparison */}
        {activeTab === 'deals' && (
          <div className="space-y-6">
            {/* Data source badge */}
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {generatedAt
                ? `Data z letáků: ${new Date(generatedAt).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}`
                : 'Ukázková data'}
            </div>

            {/* Day picker */}
            {generatedAt && <DayPicker selectedDay={selectedDay} onSelectDay={setSelectedDay} />}

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
              hasVerdicts={hasVerdicts}
              selectedVerdict={selectedVerdict}
              onVerdictChange={setSelectedVerdict}
            />

            {/* Top 6 discounts across stores */}
            {showTopDeals && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Největší slevy napříč obchody</h2>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">· podle výše slevy, max. 2 na řetězec</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {topDeals.map((deal, idx) => {
                    const cartItem = cart.find((i) => i.deal.id === deal.id);
                    return (
                      <DealCard
                        key={`top-${deal.id}`}
                        deal={deal}
                        topRank={idx + 1}
                        exchangeRate={exchangeRate}
                        cartQuantity={cartItem ? cartItem.quantity : 0}
                        onAddToCart={handleAddToCart}
                        onUpdateQuantity={handleUpdateQuantity}
                        onOpenTrickModal={setActiveTrickModalDeal}
                        onOpenFlyerPage={handleOpenFlyerPage}
                        selectedDay={selectedDay}
                      />
                    );
                  })}
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white pt-2">Všechny nabídky</h2>
              </section>
            )}

            {/* Deals Grid */}
            {filteredDeals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDeals.filter((d) => !showTopDeals || !topDealIds.has(d.id)).map((deal) => {
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
                      onOpenFlyerPage={handleOpenFlyerPage}
                      selectedDay={selectedDay}
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
                    setSelectedVerdict('all');
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
          leaflets ? (
            <LeafletGrid
              leaflets={leaflets.filter((lf) => selectedStore === 'all' || lf.store === selectedStore)}
            />
          ) : (
            <FlyerReaderModal
              initialStore={selectedStore === 'all' ? 'dino' : selectedStore}
              exchangeRate={exchangeRate}
              onAddToCart={handleAddToCart}
              cartItemIds={cartItemIds}
            />
          )
        )}

        {/* Tab 3: Cross-border Shopper Guide */}
        {activeTab === 'guide' && <BorderShoppingGuide />}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark className="w-5 h-5 shrink-0 text-slate-800 dark:text-white" />
            <span><span className="font-bold text-slate-800 dark:text-white">Lovec-slev.cz</span> · Nezávislý srovnávač polských akčních letáků a hlídač chytáků pro české nakupující.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Sledujeme: Biedronka · Dino · Lidl · Kaufland</span>
            <span>·</span>
            <span>Kurz: 1 PLN = {exchangeRate} Kč</span>
          </div>
        </div>
      </footer>

      {/* Modals & Slide-overs */}
      {flyerPageView && (
        <LeafletPager
          leaflet={flyerPageView.leaflet}
          initialPage={flyerPageView.page}
          onClose={() => setFlyerPageView(null)}
        />
      )}

      <DealDetailModal
        deal={activeTrickModalDeal}
        exchangeRate={exchangeRate}
        isOpen={!!activeTrickModalDeal}
        onClose={() => setActiveTrickModalDeal(null)}
        onAddToCart={handleAddToCart}
        isInCart={activeTrickModalDeal ? cartItemIds.has(activeTrickModalDeal.id) : false}
        onOpenFlyerPage={handleOpenFlyerPage}
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
