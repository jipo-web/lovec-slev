/** Czech number formatting helpers shared by cards, modals and the drawer. */

const czk0 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
const czk1 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pln2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 11.04 → "11,0 Kč"; values ≥ 100 are shown without decimals ("1 250 Kč"). */
export function formatCzk(value: number): string {
  return `${value >= 100 ? czk0.format(value) : czk1.format(value)} Kč`;
}

/** 1.98 → "1,98 zł" */
export function formatPln(value: number): string {
  return `${pln2.format(value)} zł`;
}

/** Bare number with Czech decimal comma and two decimals: 1.98 → "1,98" */
export function formatNum2(value: number): string {
  return pln2.format(value);
}

/** Discount in percent (0..100) or null when there is no real discount. */
export function discountPct(promo: number, regular: number): number | null {
  if (!regular || regular <= promo) return null;
  return ((regular - promo) / regular) * 100;
}

/** Discounts under this threshold are not worth showing a strikethrough price for. */
export const MIN_VISIBLE_DISCOUNT_PCT = 3;
