import { CategoryId, DealItem, StoreId, TrickType, Verdict } from '../types';

export interface PipelineConditions {
  app_only: boolean;
  multibuy: boolean;
  min_qty: number | null;
  max_qty: number | null;
  text: string | null;
}

export interface PipelineOffer {
  id: string;
  leaflet_id: string;
  store: StoreId;
  page_no: number;
  product_id: string | null;
  name: string;
  name_pl: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  quantity_text: string | null;
  price_pln: number;
  old_price_pln: number | null;
  discount_pct: number | null;
  unit_price_pln: number | null;
  unit_price_unit: string | null;
  price_czk: number | null;
  conditions: PipelineConditions;
  category: string;
  valid_from: string;
  valid_to: string;
  bbox: [number, number, number, number] | null;
  page_image_url: string | null;
  source: string;
  score: number | null;
  verdict: Verdict | null;
  reason: string | null;
  ean: string | null;
}

export interface OffersFile {
  generated_at: string;
  rate_czk_per_pln: number;
  offers: PipelineOffer[];
}

export interface PipelineLeaflet {
  id: string;
  store: StoreId;
  title: string;
  valid_from: string;
  valid_to: string;
  source_url: string;
  pdf_url: string | null;
  pages: number;
  thumbnail_url: string | null;
  page_image_urls: string[];
  offer_count: number;
  is_food: boolean;
}

export interface LeafletsFile {
  generated_at: string;
  leaflets: PipelineLeaflet[];
}

async function loadJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function loadOffers(): Promise<OffersFile | null> {
  return loadJson<OffersFile>(`${import.meta.env.BASE_URL}data/offers-latest.json`);
}

export function loadLeaflets(): Promise<LeafletsFile | null> {
  return loadJson<LeafletsFile>(`${import.meta.env.BASE_URL}data/leaflets.json`);
}

const CATEGORY_MAP: Record<string, CategoryId> = {
  mlecne: 'mlecne',
  maso_ryby: 'maso',
  uzeniny: 'maso',
  kava_caj: 'kava',
  drogerie: 'drogerie',
  domacnost: 'drogerie',
  napoje: 'napoje',
  alkohol: 'napoje',
  sladkosti: 'sladkosti',
  ovoce_zelenina: 'ovoce_zelenina',
};

const CARD_BY_STORE: Partial<Record<StoreId, string>> = {
  biedronka: 'Moja Biedronka',
  lidl: 'Lidl Plus',
  kaufland: 'Kaufland Card',
};

export function offerToDealItem(o: PipelineOffer, _rate: number): DealItem {
  const cond = o.conditions;
  let trickType: TrickType = 'clean';
  if (cond?.app_only) trickType = 'conditional_card';
  else if (cond?.multibuy || cond?.max_qty) trickType = 'trick_warning';

  const trickTitle =
    trickType === 'conditional_card'
      ? 'Sleva jen s aplikací / kartou'
      : trickType === 'trick_warning'
        ? 'Pozor na podmínky akce'
        : 'Čistá sleva';

  return {
    id: o.id,
    store: o.store,
    title: o.name || o.name_pl,
    polishTitle: o.name_pl || o.name,
    category: CATEGORY_MAP[o.category] ?? 'trvanlive',
    promoPricePln: o.price_pln,
    regularPricePln: o.old_price_pln ?? o.price_pln,
    czechEquivalentCzk: 0,
    unit: o.unit_price_unit ? `${o.unit_price_unit}` : 'ks',
    packageSize: o.quantity_text ?? '',
    trickType,
    trickTitle,
    trickExplanation: cond?.text || o.reason || '',
    requiredCard: cond?.app_only ? (CARD_BY_STORE[o.store] ?? null) : null,
    minQuantity: cond?.min_qty ?? undefined,
    maxLimit: cond?.max_qty ? `Max ${cond.max_qty} ks` : undefined,
    validFrom: o.valid_from,
    validUntil: o.valid_to,
    flyerPage: o.page_no,
    flyerName: o.leaflet_id,
    isHeroPromo: o.verdict === 'trhak',
    verdict: o.verdict,
    score: o.score,
    reason: o.reason,
    unitPricePln: o.unit_price_pln,
    unitPriceUnit: o.unit_price_unit,
    pageImageUrl: o.page_image_url,
    bbox: o.bbox,
    leafletId: o.leaflet_id,
    source: o.source,
  };
}
