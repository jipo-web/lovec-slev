export type StoreId = 'biedronka' | 'lidl' | 'kaufland' | 'carrefour' | 'dino';

export type TrickType = 'clean' | 'conditional_card' | 'trick_warning';

export type CategoryId = 
  | 'all'
  | 'maso'
  | 'mlecne'
  | 'kava'
  | 'drogerie'
  | 'trvanlive'
  | 'napoje'
  | 'sladkosti'
  | 'ovoce_zelenina';

export interface DealItem {
  id: string;
  store: StoreId;
  title: string;
  polishTitle: string;
  category: CategoryId;
  promoPricePln: number;
  regularPricePln: number;
  czechEquivalentCzk: number;
  unit: string;
  packageSize: string;
  trickType: TrickType;
  trickTitle: string;
  trickExplanation: string;
  requiredCard: string | null;
  minQuantity?: number;
  maxLimit?: string;
  validFrom: string;
  validUntil: string;
  flyerPage: number;
  flyerName: string;
  isHeroPromo?: boolean;
}

export interface StoreInfo {
  id: StoreId;
  name: string;
  tagline: string;
  brandColor: string;
  accentBg: string;
  textColor: string;
  website: string;
  loyaltySystem: string;
  loyaltyCardName: string | null;
  requiresApp: boolean;
  borderShopperTip: string;
  flyerName: string;
  flyerDates: string;
  flyerTotalPages: number;
}

export interface CartItem {
  deal: DealItem;
  quantity: number;
}

export interface CustomCartItem {
  id: string;
  title: string;
  estimatedPricePln: number;
  quantity: number;
  store?: StoreId;
}
