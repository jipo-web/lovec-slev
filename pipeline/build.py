"""Write the JSON files the frontend reads (public/data/)."""
from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timedelta, timezone

from .config import OUT_DIR
from .crops import offer_images, publish
from .db import all_offers, row_to_leaflet


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def build(con: sqlite3.Connection, rate: float, today: date | None = None, horizon_days: int = 14) -> dict:
    today = today or date.today()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    until = (today + timedelta(days=horizon_days)).isoformat()

    offers = all_offers(con, "valid_to>=? AND valid_from<=?", (today.isoformat(), until))
    offers.sort(key=lambda o: (-(o.score or -9), o.store, o.page_no))
    images = offer_images(con)
    for o in offers:
        o.image_url = images.get(o.id)
    publish({o.image_url for o in offers if o.image_url})
    offers_json = {"generated_at": _now(), "rate_czk_per_pln": round(rate, 4),
                   "offers": [o.model_dump(mode="json") for o in offers]}
    (OUT_DIR / "offers-latest.json").write_text(json.dumps(offers_json, ensure_ascii=False), encoding="utf-8")

    counts: dict[str, int] = {}
    for o in offers:
        counts[o.leaflet_id] = counts.get(o.leaflet_id, 0) + 1
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
