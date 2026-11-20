import { DealItem } from '../types';
import { formatNum2 } from './format';

export interface CzechComparison {
  /** Positive = cheaper in Poland, negative = cheaper in Czechia (percent of the Czech price). */
  pct: number;
  /** "v ČR v akci od 99,60 Kč/kg (Tesco)" */
  reference: string;
  /** "v Polsku o 17 % levněji" / "v ČR o 25 % levněji" / "stejně jako v ČR" */
  verdict: string;
  tone: 'cheaper' | 'same' | 'dearer';
}

/** Compares the Polish unit price (in CZK) with the cheapest Czech promotion of the same kind. */
export function czechComparison(deal: DealItem, exchangeRate: number): CzechComparison | null {
  const ref = deal.czRef;
  if (!ref || !deal.unitPricePln || deal.unitPriceUnit !== ref.unit || ref.unitPriceCzk <= 0) return null;
  const plCzk = deal.unitPricePln * exchangeRate;
  const pct = Math.round((1 - plCzk / ref.unitPriceCzk) * 100);
  const reference = `v ČR v akci od ${formatNum2(ref.unitPriceCzk)} Kč/${ref.unit} (${ref.chain})`;
  if (pct >= 3) return { pct, reference, verdict: `v Polsku o ${pct} % levněji`, tone: 'cheaper' };
  if (pct <= -3) return { pct, reference, verdict: `v ČR o ${-pct} % levněji`, tone: 'dearer' };
  return { pct, reference, verdict: 'stejně jako v ČR', tone: 'same' };
}
