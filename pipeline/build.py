"""Write the JSON files the frontend reads (public/data/)."""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import date, datetime, timedelta, timezone

from .config import OUT_DIR
from .crops import offer_images, publish
from .czprices import cz_reference, load_cz_prices
from .db import all_offers, row_to_leaflet


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _norm_name(s: str | None) -> str:
    return re.sub(r"[^0-9a-ząćęłńóśźż]+", " ", (s or "").lower()).strip()


_MEASURE = re.compile(r"(?:\d+x)?\d+(?:[.,]\d+)?(?:kg|g|ml|l|szt)(?![a-ząćęłńóśźż])")


def _norm_qty(s: str | None) -> str:
    """Pack size only: '250 G-300 G' == '250 g-300 g', '1 L + kaucja 0,50 zł' == '1 l',
    'Dwunastosztuk, 12 x 500 ml' == '12 x 500 ml'. A bare unit like '/para' says nothing."""
    q = re.sub(r"\s+", "", (s or "").lower())
    q = re.sub(r"\+?kaucja.*", "", q)
    found = _MEASURE.findall(q)
    if found:
        return "-".join(found)
    q = q.rstrip(".")
    return "" if not q or q.startswith("/") else q


def _shopper_key(o) -> tuple:
    """What a shopper compares: same product, pack, price, validity and conditions.

    Leaflets repeat offers (title page + section page, regional variants). Two
    rows that differ in any of these stay separate – e.g. one Lidl butter with
    "max. 3 opak." and one without the limit."""
    c = o.conditions
    return (o.store, _norm_name(o.name_pl or o.name), o.price_pln, o.old_price_pln, _norm_qty(o.quantity_text),
            str(o.valid_from), str(o.valid_to), c.app_only, c.multibuy, c.min_qty, c.max_qty)


def dedupe_offers(offers: list) -> list:
    """Keep one offer per shopper key; prefer one with a product photo, then the earlier page."""
    best: dict[tuple, object] = {}
    for o in offers:
        k = _shopper_key(o)
        cur = best.get(k)
        if cur is None or (bool(o.image_url), -o.page_no) > (bool(cur.image_url), -cur.page_no):
            best[k] = o
    keep = {id(o) for o in best.values()}
    return [o for o in offers if id(o) in keep]


def merge_reissued(offers: list) -> list:
    """Merge one offer printed in several leaflets that are valid at the same time.

    Stores reissue leaflets while the previous one still runs: Biedronka's Monday
    and Thursday "Codziennie niskie ceny" overlap for three days, Lidl's weekly
    "Rewolucja cenowa" exists in up to three live copies. The copies carry the same
    product, pack and price, but the model reads their condition text slightly
    differently, so `dedupe_offers` keeps them all.

    Offers merge when they come from different leaflets of one store and have the
    same name, price and mechanic (multibuy, min. quantity), compatible packs
    (equal, or one unknown) and validity that overlaps or follows within a day.
    The kept offer gets the union of the validity and the stricter app-only flag.
    It is the one with a photo, then from the newest leaflet. Two offers from the
    same leaflet never merge here – those differences are deliberate
    (see `dedupe_offers`)."""
    groups: dict[tuple, list] = {}
    for o in offers:
        c = o.conditions
        k = (o.store, _norm_name(o.name_pl or o.name), o.price_pln, bool(c.multibuy), c.min_qty)
        groups.setdefault(k, []).append(o)

    drop: set[int] = set()
    for members in groups.values():
        if len({o.leaflet_id for o in members}) < 2:
            continue
        clusters: list[dict] = []
        for o in sorted(members, key=lambda o: (o.valid_from, o.valid_to)):
            q = _norm_qty(o.quantity_text)
            for cl in clusters:
                if (o.leaflet_id not in cl["leaflets"] and (not q or not cl["qty"] or q == cl["qty"])
                        and o.valid_from <= cl["to"] + timedelta(days=1)):
                    cl["items"].append(o)
                    cl["leaflets"].add(o.leaflet_id)
                    cl["qty"] = cl["qty"] or q
                    cl["to"] = max(cl["to"], o.valid_to)
                    break
            else:
                clusters.append({"items": [o], "leaflets": {o.leaflet_id}, "qty": q, "to": o.valid_to})
        for cl in clusters:
            items = cl["items"]
            if len(items) < 2:
                continue
            keep = max(items, key=lambda o: (bool(o.image_url), o.valid_from, -o.page_no))
            keep.valid_from = min(o.valid_from for o in items)
            keep.valid_to = max(o.valid_to for o in items)
            keep.conditions.app_only = any(o.conditions.app_only for o in items)
            if keep.old_price_pln is None:  # one copy printed the regular price, the other did not
                donor = next((o for o in items if o.old_price_pln is not None), None)
                if donor:
                    keep.old_price_pln, keep.discount_pct = donor.old_price_pln, donor.discount_pct
                    keep.score, keep.verdict, keep.reason = donor.score, donor.verdict, donor.reason
            drop.update(id(o) for o in items if o is not keep)
    return [o for o in offers if id(o) not in drop]


def build(con: sqlite3.Connection, rate: float, today: date | None = None, horizon_days: int = 14) -> dict:
    today = today or date.today()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    until = (today + timedelta(days=horizon_days)).isoformat()

    offers = all_offers(con, "valid_to>=? AND valid_from<=?", (today.isoformat(), until))
    offers.sort(key=lambda o: (-(o.score or -9), o.store, o.page_no))
    images = offer_images(con)
    for o in offers:
        o.image_url = images.get(o.id)
    counts: dict[str, int] = {}
    for o in offers:  # leaflet tiles count every offer printed in that leaflet
        counts[o.leaflet_id] = counts.get(o.leaflet_id, 0) + 1
    offers = merge_reissued(dedupe_offers(offers))
    publish({o.image_url for o in offers if o.image_url})
    refs = load_cz_prices(con, today)
    dumped = []
    for o in offers:
        d = o.model_dump(mode="json")
        qty = o.quantity if o.unit == o.unit_price_unit else None
        d["cz_ref"] = cz_reference(o.name_pl or o.name, o.unit_price_pln, o.unit_price_unit, qty, refs, rate)
        dumped.append(d)
    offers_json = {"generated_at": _now(), "rate_czk_per_pln": round(rate, 4),
                   "cz_source": {"name": "ojeb.cz", "url": "https://ojeb.cz/"}, "offers": dumped}
    (OUT_DIR / "offers-latest.json").write_text(json.dumps(offers_json, ensure_ascii=False), encoding="utf-8")

    leaflets = []
    for r in con.execute("SELECT * FROM leaflets WHERE valid_to>=? AND valid_from<=? ORDER BY store, valid_from",
                         (today.isoformat(), until)):
        lf = row_to_leaflet(r)
        leaflets.append({
            "id": lf.id, "store": lf.store, "title": lf.title,
            "valid_from": lf.valid_from.isoformat(), "valid_to": lf.valid_to.isoformat(),
            "source_url": lf.source_url, "pdf_url": lf.pdf_url, "pages": lf.pages,
            "thumbnail_url": lf.extra.get("thumbnail_url") or (lf.page_image_urls[0] if lf.page_image_urls else None),
            "page_image_urls": lf.page_image_urls, "offer_count": counts.get(lf.id, 0),
            "is_food": lf.is_food, "variant": lf.variant, "status": r["status"],
            "valid_to_estimated": bool(lf.extra.get("valid_to_estimated")),
        })
    # Group promotions without a printed price ("wszystkie konserwy rybne 2+1") live in pages.raw_json
    promos = []
    for r in con.execute(
        "SELECT p.leaflet_id, p.page_no, p.raw_json, l.store, l.valid_from, l.valid_to FROM pages p JOIN leaflets l ON l.id=p.leaflet_id "
        "WHERE l.valid_to>=? AND l.valid_from<=? AND p.method='vision'", (today.isoformat(), until)):
        for raw in json.loads(r["raw_json"] or "[]"):
            if raw.get("price_text") or not (raw.get("conditions_text") or raw.get("discount_text")):
                continue
            promos.append({"leaflet_id": r["leaflet_id"], "store": r["store"], "page_no": r["page_no"],
                           "name": raw.get("name"), "brand": raw.get("brand"),
                           "mechanic": raw.get("discount_text") or raw.get("conditions_text"),
                           "conditions": raw.get("conditions_text"), "category": raw.get("category"),
                           "valid_from": r["valid_from"], "valid_to": r["valid_to"]})
    (OUT_DIR / "group-promos.json").write_text(
        json.dumps({"generated_at": _now(), "promos": promos}, ensure_ascii=False), encoding="utf-8")

    (OUT_DIR / "leaflets.json").write_text(
        json.dumps({"generated_at": _now(), "leaflets": leaflets}, ensure_ascii=False), encoding="utf-8")
    return {"offers": len(offers), "images": sum(1 for o in offers if o.image_url), "leaflets": len(leaflets), "group_promos": len(promos)}
