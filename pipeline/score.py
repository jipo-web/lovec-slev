"""Deal scoring → score 0..1-ish and a verdict.

score = w_hist * (1 - price / median(history 8 weeks, all stores))
      + w_cross * (1 - price / min(current price elsewhere))
      + w_unit * (1 - percentile of unit price within category today)
Signals that are unavailable redistribute their weight to the others.
"""
from __future__ import annotations

import sqlite3
import statistics
from datetime import date, timedelta

from .config import HISTORY_WEEKS, WEIGHTS
from .models import Offer

VERDICT_LABEL = {"trhak": "Trhák", "dobra_koupe": "Dobrá koupě", "nic_moc": "Nic moc", "past": "Past"}


def _history(con: sqlite3.Connection, today: date) -> dict[str, list[tuple[str, float, str]]]:
    since = (today - timedelta(weeks=HISTORY_WEEKS)).isoformat()
    hist: dict[str, list[tuple[str, float, str]]] = {}
    for r in con.execute(
        "SELECT product_id, price_pln, valid_from, store FROM offers WHERE product_id IS NOT NULL AND valid_from>=? AND valid_to<?",
        (since, today.isoformat()),
    ):
        hist.setdefault(r[0], []).append((r[2], r[1], r[3]))
    return hist


def score_offers(con: sqlite3.Connection, offers: list[Offer], today: date | None = None) -> None:
    today = today or date.today()
    hist = _history(con, today)

    # cross-store: lowest current price per product among the offers being scored
    cur_min: dict[str, float] = {}
    for o in offers:
        if o.product_id:
            cur_min[o.product_id] = min(cur_min.get(o.product_id, 1e9), o.price_pln)

    # unit price percentile within category
    by_cat: dict[str, list[float]] = {}
    for o in offers:
        if o.unit_price_pln and o.unit in ("kg", "l"):
            by_cat.setdefault(o.category, []).append(o.unit_price_pln)
    for v in by_cat.values():
        v.sort()

    for o in offers:
        parts: dict[str, float] = {}
        reasons: list[str] = []
        h = hist.get(o.product_id or "", [])
        if len(h) >= 2:
            med = statistics.median(p for _, p, _ in h)
            parts["history"] = max(-1.0, min(1.0, 1 - o.price_pln / med))
            lowest = min(p for _, p, _ in h)
            if o.price_pln <= lowest:
                reasons.append(f"Nejnižší cena za {HISTORY_WEEKS} týdnů")
            elif o.price_pln > med:
                reasons.append(f"Dráž než obvyklých {med:.2f} zł")
            recent = [d for d, _, _ in h if d >= (today - timedelta(weeks=3)).isoformat()]
            if recent and parts["history"] < 0.1:
                reasons.append("V akci skoro pořád")
        if o.product_id and o.product_id in cur_min:
            others = [p.price_pln for p in offers if p.product_id == o.product_id and p.store != o.store]
            if others:
                best = min(others)
                parts["cross_store"] = max(-1.0, min(1.0, 1 - o.price_pln / best))
                if best < o.price_pln:
                    cheaper = next(p.store for p in offers if p.product_id == o.product_id and p.price_pln == best)
                    reasons.append(f"Jinde levněji: {cheaper.capitalize()} {best:.2f} zł")
                elif best > o.price_pln:
                    reasons.append(f"Nejlevněji ze sledovaných řetězců")
        if o.unit_price_pln and o.unit in ("kg", "l") and len(by_cat.get(o.category, [])) >= 5:
            arr = by_cat[o.category]
            rank = sum(1 for v in arr if v < o.unit_price_pln) / len(arr)
            parts["unit_price"] = 1 - rank - 0.5  # centred: cheapest → +0.5, dearest → -0.5
            if rank <= 0.1:
                reasons.append("Mezi nejlevnějšími za jednotku v kategorii")
        if not parts and o.discount_pct:
            parts["declared"] = min(1.0, o.discount_pct / 100) * 0.5  # weak signal
            reasons.append(f"Deklarovaná sleva {o.discount_pct:.0f} %")
        if not parts:
            o.score, o.verdict, o.reason = None, None, None
            continue
        weight = sum(WEIGHTS.get(k, 0.3) for k in parts)
        o.score = round(sum(WEIGHTS.get(k, 0.3) * v for k, v in parts.items()) / weight, 3)
        if "history" not in parts and "cross_store" not in parts:
            o.score = min(o.score, 0.34)  # unit price / declared discount alone never make a "trhák" or a "past"
            o.score = max(o.score, 0.0)
        if o.score >= 0.35:
            o.verdict = "trhak"
        elif o.score >= 0.15:
            o.verdict = "dobra_koupe"
        elif o.score >= 0:
            o.verdict = "nic_moc"
        else:
            o.verdict = "past"
        if o.conditions.app_only and o.verdict in ("trhak", "dobra_koupe"):
            reasons.append("Jen s aplikací / kartou")
        o.reason = "; ".join(reasons[:2]) or None
