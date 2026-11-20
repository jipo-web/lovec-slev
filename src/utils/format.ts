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

const WEEKDAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

function parseIsoDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
}

export interface ValidityInfo {
  /** "po 16. 11. – so 21. 11." or "jen po 16. 11." */
  label: string;
  /** "končí so 21. 11." / "od ne 22. 11." … or null */
  urgency: string | null;
  /** Short promotion (≤ 3 days) or ending today/tomorrow – worth highlighting */
  highlight: boolean;
}

/** Human validity of an offer relative to `today` (ISO day, defaults to now – the day the user browses). */
export function validityInfo(validFrom: string, validUntil: string, today?: string): ValidityInfo {
  const a = parseIsoDay(validFrom);
  const b = parseIsoDay(validUntil);
  const t = today ? parseIsoDay(today) : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const toEnd = Math.round((b.getTime() - t.getTime()) / 86400000);
  const toStart = Math.round((a.getTime() - t.getTime()) / 86400000);

  const label = days === 1 ? `jen ${dayLabel(a)}` : `${dayLabel(a)} – ${dayLabel(b)}`;
  // Always a concrete date: the user may browse another day than today, so
  // "dnes"/"zítra" relative to the selected day would be misleading.
  let urgency: string | null = null;
  if (toStart >= 1) urgency = `od ${dayLabel(a)}`;
  else if (toEnd === 0 || toEnd === 1) urgency = `končí ${dayLabel(b)}`;
  return { label, urgency, highlight: days <= 3 || (toStart <= 0 && toEnd <= 1) };
}
