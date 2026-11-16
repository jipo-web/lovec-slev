"""Offers that the store already serves as data – no OCR, no model.

Dino: hotspots per page with product name, price, EAN and position.
Lidl: the flyer API's `products` map (mostly non-food, with price and brand).
"""
from __future__ import annotations

from ..models import Leaflet, RawOffer


def dino_offers(leaflet: Leaflet) -> dict[int, list[RawOffer]]:
    by_page: dict[int, list[RawOffer]] = {}
    for p in leaflet.extra.get("products", []):
        page_no = int(p.get("page_no") or 1)
        x, y = p.get("x"), p.get("y")
        bbox = [x / 100, y / 100, min(1.0, x / 100 + 0.02), min(1.0, y / 100 + 0.02)] if x is not None and y is not None else None
        by_page.setdefault(page_no, []).append(
            RawOffer(name=p["name"], price_text=str(p.get("price") or ""), ean=p.get("ean"), bbox=bbox)
        )
    return by_page


def lidl_product_offers(leaflet: Leaflet) -> list[RawOffer]:
    out = []
    for p in leaflet.extra.get("products", []):
        if not p.get("title") or not p.get("price"):
            continue
        out.append(
            RawOffer(
                name=p["title"],
                brand=p.get("brand"),
                price_text=str(p["price"]),
                old_price_text=str(p.get("oldPrice")) if p.get("oldPrice") else None,
                category=p.get("categoryPrimary") or "ostatni",
            )
        )
    return out
