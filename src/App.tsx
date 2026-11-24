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
import { PrivacyPage } from './components/PrivacyPage';
import { ShieldAlert, HelpCircle, Flame, CloudOff, RefreshCw, ExternalLink } from 'lucide-react';
import { discountPct, MIN_VISIBLE_DISCOUNT_PCT } from './utils/format';
import { linePrice } from './utils/pricing';
import { foldText, matchesTokens, queryTokens } from './utils/search';

/** Cards rendered at once; more on "Zobrazit další". Keeps the DOM small and filters fast. */
const PAGE_SIZE = 60;

type DataStatus = 'loading' | 'ready' | 'error';

/** "2026-11-19T01:34:00+01:00" → "19. 11. 2026 v 1:34" (same style as the rest of the site) */
function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} v ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function App() {
  // Navigation & View tabs
  const [activeTab, setActiveTab] = useState<'deals' | 'flyers' | 'guide' | 'privacy'>(() =>
    typeof window !== 'undefined' && window.location.hash === '#soukromi' ? 'privacy' : 'deals'
  );

  // Filters & Search
  const [selectedStore, setSelectedStore] = useState<StoreId | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [selectedTrickType, setSelectedTrickType] = useState<TrickType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('discount_pct');
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | 'all'>('all');
  const [selectedDay, setSelectedDay] = useState<string>(() => toIsoDay(new Date()));

  // Data source: pipeline JSON. Demo data only in local development, never silently in production.
  const [allDeals, setAllDeals] = useState<DealItem[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading');
  const [isDemoData, setIsDemoData] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
  // #soukromi opens the privacy page (footer link, shared link, back button)
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#soukromi') {
        setActiveTab('privacy');
        window.scrollTo({ top: 0 });
      } else {
        setActiveTab((t) => (t === 'privacy' ? 'deals' : t));
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (activeTab !== 'privacy' && window.location.hash === '#soukromi') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [activeTab]);

  const handleGoHome = () => {
    setActiveTab('deals');
    setSelectedStore('all');
    setSelectedCategory('all');
    setSelectedTrickType('all');
    setSelectedVerdict('all');
    setSearchQuery('');
    setSortBy(hasVerdicts ? 'score' : 'discount_pct');
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

  // Load real data from the pipeline. A failed load shows an error with a retry –
  // never expired demo offers dressed up as today's deals.
  useEffect(() => {
    let cancelled = false;
    setDataStatus('loading');
    loadOffers().then((file) => {
      if (cancelled) return;
      if (!file || !file.offers || file.offers.length === 0) {
        if (import.meta.env.DEV) {
          setAllDeals(DEALS);
          setIsDemoData(true);
          setDataStatus('ready');
        } else {
          setDataStatus('error');
        }
        return;
      }
      setAllDeals(file.offers.map((o) => offerToDealItem(o, file.rate_czk_per_pln)));
      setGeneratedAt(file.generated_at);
      setIsDemoData(false);
      if (file.rate_czk_per_pln > 0 && localStorage.getItem('lovci_pln_rate') === null) {
        setExchangeRate(file.rate_czk_per_pln);
      }
      setSortBy(file.offers.some((o) => o.verdict) ? 'score' : 'discount_pct');
      setDataStatus('ready');
    });
    loadLeaflets().then((file) => {
      if (cancelled || !file || !file.leaflets || file.leaflets.length === 0) return;
      setLeaflets(file.leaflets);
    });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const hasVerdicts = useMemo(() => allDeals.some((d) => d.verdict), [allDeals]);
  // Czech reference prices are not in the live data yet – the "vs ČR" sort only appears once they are.
  const hasCzechPrices = useMemo(() => allDeals.some((d) => d.czechEquivalentCzk > 0), [allDeals]);
  useEffect(() => {
    if (sortBy === 'savings_pct' && !hasCzechPrices && dataStatus === 'ready') setSortBy('discount_pct');
  }, [sortBy, hasCzechPrices, dataStatus]);

  // Folded search text per deal (computed once per data load, not per keystroke)
  const searchIndex = useMemo(() => {
    const m = new Map<string, string>();
    allDeals.forEach((d) =>
      m.set(d.id, foldText([d.title, d.polishTitle, STORES[d.store].name, d.packageSize, d.trickExplanation].join(' ')))
    );
    return m;
  }, [allDeals]);

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

  // Sync cart (storage can be unavailable, e.g. in private mode – the list then lives only in this tab)
  useEffect(() => {
    try {
      localStorage.setItem('lovci_cart', JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart]);

  // Sync custom items
  useEffect(() => {
    try {
      localStorage.setItem('lovci_custom_items', JSON.stringify(customItems));
    } catch {
      /* ignore */
    }
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

  // The list is kept in the browser until the user deletes items – but an offer
  // whose promotion has ended is removed (and the user is told which ones).
  const [expiredRemoved, setExpiredRemoved] = useState<string[]>([]);
  useEffect(() => {
    if (dataStatus !== 'ready' || isDemoData) return;
    const today = toIsoDay(new Date());
    const ended = cart.filter((item) => item.deal.validUntil && item.deal.validUntil < today);
    if (ended.length === 0) return;
    const endedIds = new Set(ended.map((i) => i.deal.id));
    setCart((prev) => prev.filter((item) => !endedIds.has(item.deal.id)));
    setExpiredRemoved(ended.map((i) => i.deal.title));
    // Runs when fresh data arrives (each visit), not on every cart change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStatus, isDemoData]);

  // Cart entries saved before a data refresh keep their old copy of the deal;
  // refresh them so conditions (min/max, regular price) are current.
  useEffect(() => {
    if (dataStatus !== 'ready' || isDemoData) return;
    const byId = new Map(allDeals.map((d) => [d.id, d]));
    setCart((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const fresh = byId.get(item.deal.id);
        if (fresh && fresh !== item.deal) {
          changed = true;
          return { ...item, deal: fresh };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [allDeals, dataStatus, isDemoData]);

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

  // Totals honour the deal conditions: below the minimum, over the limit or in an
  // incomplete bundle the shopper pays the regular price.
  const totalCartCzk = useMemo(() => {
    const dealsPln = cart.reduce((sum, item) => sum + linePrice(item.deal, item.quantity).totalPln, 0);
    const customPln = customItems.reduce((sum, item) => sum + item.estimatedPricePln * item.quantity, 0);
    return (dealsPln + customPln) * exchangeRate;
  }, [cart, customItems, exchangeRate]);

  const totalSavedCzk = useMemo(() => {
    const priced = cart.filter((item) => item.deal.czechEquivalentCzk > 0);
    const dealsPln = priced.reduce((sum, item) => sum + linePrice(item.deal, item.quantity).totalPln, 0);
    const dealsCzCzk = priced.reduce((sum, item) => sum + item.deal.czechEquivalentCzk * item.quantity, 0);
    return Math.max(0, dealsCzCzk - dealsPln * exchangeRate);
  }, [cart, exchangeRate]);

  // Filtered & sorted deals
  const filteredDeals = useMemo(() => {
    const tokens = queryTokens(searchQuery);
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

      // Search query: no diacritics needed, every word must match
      if (tokens.length) return matchesTokens(searchIndex.get(deal.id) ?? '', tokens);

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
      if (sortBy === 'discount_pct') {
        const pct = (d: DealItem) => discountPct(d.promoPricePln, d.regularPricePln) ?? -1;
        return pct(b) - pct(a);
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
  }, [allDeals, searchIndex, generatedAt, selectedDay, selectedStore, selectedCategory, selectedTrickType, selectedVerdict, searchQuery, sortBy, exchangeRate]);

  // New filter → start again with the first page of cards
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedDay, selectedStore, selectedCategory, selectedTrickType, selectedVerdict, searchQuery, sortBy]);

  const cartItemIds = useMemo(() => new Set(cart.map((c) => c.deal.id)), [cart]);
  const cartQtyById = useMemo(() => new Map(cart.map((c) => [c.deal.id, c.quantity])), [cart]);

  // Deals valid on the selected day (before store/category/search filters)
  const dealsForDay = useMemo(
    () => allDeals.filter((d) => !generatedAt || (d.validFrom <= selectedDay && d.validUntil >= selectedDay)),
    [allDeals, generatedAt, selectedDay]
  );

  // Deal counts by store for the selected day – the same base as the hero ("nabídek dnes")
  const dealCountsByStore = useMemo(() => {
    const counts: Record<StoreId, number> = { biedronka: 0, dino: 0, lidl: 0, kaufland: 0 };
    dealsForDay.forEach((d) => {
      counts[d.store] = (counts[d.store] || 0) + 1;
    });
    return counts;
  }, [dealsForDay]);

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
  const gridDeals = useMemo(
    () => (showTopDeals ? filteredDeals.filter((d) => !topDealIds.has(d.id)) : filteredDeals),
    [filteredDeals, showTopDeals, topDealIds]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-red-100 selection:text-red-900 overflow-x-clip">
      <a
        href="#obsah"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-slate-900 focus:shadow-lg"
      >
        Přeskočit na obsah
      </a>
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
      <main id="obsah" tabIndex={-1} className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 focus:outline-none">
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
            <div className="grid grid-cols-4 gap-2 sm:gap-4 shrink-0 text-center" aria-busy={dataStatus === 'loading'}>
              <div>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">{dataStatus === 'ready' ? heroStats.offers : '…'}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">nabídek dnes</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">{dataStatus === 'ready' ? heroStats.stores : '…'}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">řetězce</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {dataStatus !== 'ready' ? '…' : heroStats.medianDiscount > 0 ? `-${heroStats.medianDiscount} %` : '–'}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">typická sleva</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400 font-mono tabular-nums">{dataStatus === 'loading' ? '…' : exchangeRate}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">Kč / 1 zł</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Deals – loading / error states first */}
        {activeTab === 'deals' && dataStatus === 'loading' && (
          <div className="space-y-4" aria-live="polite" aria-busy="true">
            <span className="sr-only">Načítám aktuální letáky…</span>
            <div className="h-10 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
            <div className="h-36 rounded-2xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-[26rem] rounded-2xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'deals' && dataStatus === 'error' && (
          <div role="alert" className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900 space-y-4">
            <CloudOff className="w-10 h-10 text-rose-500 mx-auto" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Aktuální letáky se nepodařilo načíst
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              Neukazujeme starší ani ukázkové nabídky, aby vás nesvedly ke špatnému nákupu. Zkuste to za chvíli znovu,
              nebo se podívejte přímo do letáků obchodů.
            </p>
            <button
              onClick={() => setLoadAttempt((n) => n + 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" /> Zkusit znovu
            </button>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
              {Object.values(STORES).map((st) => (
                <a
                  key={st.id}
                  href={st.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white underline underline-offset-2"
                >
                  {st.name} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tab 1: Deals & Price Comparison */}
        {activeTab === 'deals' && dataStatus === 'ready' && (
          <div className="space-y-6">
            {/* Data source badge */}
            {isDemoData ? (
              <div role="status" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-900 dark:text-amber-200">
                Ukázková data pro vývoj – nejsou to aktuální nabídky (chybí public/data/offers-latest.json).
              </div>
            ) : (
              generatedAt && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  Data z letáků: {formatGeneratedAt(generatedAt)}
                </div>
              )
            )}

            {expiredRemoved.length > 0 && !isCartOpen && (
              <div role="status" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3">
                <span>
                  Z nákupního lístku jsme odebrali {expiredRemoved.length === 1 ? 'položku, jejíž akce skončila' : `${expiredRemoved.length} položky, jejichž akce skončily`}:{' '}
                  <strong>{expiredRemoved.join(', ')}</strong>.
                </span>
                <button onClick={() => setExpiredRemoved([])} className="shrink-0 font-semibold underline" aria-label="Zavřít oznámení">
                  OK
                </button>
              </div>
            )}

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
              hasCzechPrices={hasCzechPrices}
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
                    return (
                      <DealCard
                        key={`top-${deal.id}`}
                        deal={deal}
                        topRank={idx + 1}
                        exchangeRate={exchangeRate}
                        cartQuantity={cartQtyById.get(deal.id) ?? 0}
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
            {gridDeals.length > 0 ? (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {gridDeals.slice(0, visibleCount).map((deal) => {
                  const quantity = cartQtyById.get(deal.id) ?? 0;

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
              {gridDeals.length > visibleCount && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <button
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                    className="min-h-11 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold"
                  >
                    Zobrazit další nabídky
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Zobrazeno {Math.min(visibleCount, gridDeals.length)} z {gridDeals.length}
                  </span>
                </div>
              )}
              </>
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

        {/* Privacy page (#soukromi) */}
        {activeTab === 'privacy' && <PrivacyPage />}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark className="w-5 h-5 shrink-0 text-slate-800 dark:text-white" />
            <span>
              <span className="font-bold text-slate-800 dark:text-white">Lovec-slev.cz</span> · Nezávislý srovnávač polských akčních letáků a hlídač chytáků pro české nakupující.
              <span className="block mt-1">
                Našel jsi chybu? Napiš na{' '}
                <a href="mailto:jiri@polednik.info" className="underline underline-offset-2 hover:text-slate-800 dark:hover:text-white">
                  jiri@polednik.info
                </a>
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
            <span>Sledujeme: Biedronka · Dino · Lidl · Kaufland</span>
            <span>·</span>
            <a
              href="#soukromi"
              onClick={() => {
                setActiveTab('privacy');
                window.scrollTo({ top: 0 });
              }}
              className="underline underline-offset-2"
            >
              Soukromí
            </a>
            <span>·</span>
            <span>Kurz: 1 PLN = {exchangeRate} Kč</span>
            {hasCzechPrices && (
              <>
                <span>·</span>
                <span>
                  České ceny:{' '}
                  <a href="https://ojeb.cz/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    ojeb.cz
                  </a>
                </span>
              </>
            )}
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
        expiredRemoved={expiredRemoved}
        onDismissExpired={() => setExpiredRemoved([])}
      />
    </div>
  );
}
