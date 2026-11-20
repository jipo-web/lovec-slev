import { DealItem } from '../types';

/** What one shopping-list line really costs, given the deal's conditions. */
export interface LinePrice {
  totalPln: number;
  /** Pieces that get the promo price. */
  promoUnits: number;
  /** Pieces paid at the regular price (below the minimum, over the limit, incomplete bundle). */
  regularUnits: number;
  /** False when the leaflet prints no regular price – regular pieces are then priced at the promo price. */
  regularKnown: boolean;
  /** Short Czech notes explaining why some pieces are not at the promo price. */
  notes: string[];
  /** Quantity that would get every piece at the promo price (null when already the case). */
  suggestedQuantity: number | null;
}

export function linePrice(deal: DealItem, quantity: number): LinePrice {
  const promo = deal.promoPricePln;
  const regularKnown = deal.regularPricePln > promo;
  const regular = regularKnown ? deal.regularPricePln : promo;
  const min = deal.minQuantity && deal.minQuantity > 1 ? deal.minQuantity : 1;
  const max = deal.maxQuantity && deal.maxQuantity >= min ? deal.maxQuantity : undefined;
  const qty = Math.max(0, Math.floor(quantity));

  const eligible = max ? Math.min(qty, max) : qty;
  let promoUnits: number;
  if (min <= 1) promoUnits = eligible;
  else if (deal.promoInBundles) promoUnits = Math.floor(eligible / min) * min;
  else promoUnits = eligible >= min ? eligible : 0;
  const regularUnits = qty - promoUnits;

  const notes: string[] = [];
  let suggestedQuantity: number | null = null;
  if (qty > 0 && regularUnits > 0) {
    const regLabel = regularKnown ? `běžnou cenu ${fmt(regular)} zł` : 'běžnou cenu (leták ji neuvádí, počítáno akční)';
    if (promoUnits === 0 && min > 1) {
      notes.push(`Akční cena platí až od ${min} ks – ${qty} ks za ${regLabel}`);
      suggestedQuantity = min;
    } else if (max && qty > max) {
      notes.push(`Limit akce ${max} ks – ${qty - max} ks navíc za ${regLabel}`);
    } else if (deal.promoInBundles) {
      notes.push(`Akce platí po ${min} ks – ${regularUnits} ks za ${regLabel}`);
      suggestedQuantity = Math.ceil(qty / min) * min;
      if (max && suggestedQuantity > max) suggestedQuantity = null;
    }
  }

  return {
    totalPln: promoUnits * promo + regularUnits * regular,
    promoUnits,
    regularUnits,
    regularKnown,
    notes,
    suggestedQuantity,
  };
}

function fmt(v: number): string {
  return v.toFixed(2).replace('.', ',');
}
