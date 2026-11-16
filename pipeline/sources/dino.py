"""Dino (marketdino.pl) – a Nuxt site whose payload already lists products.

https://marketdino.pl/gazetki/lista/standard/_payload.json is a devalue-encoded
Nuxt payload. Decoded, `leaflets-list.standard` is a list of leaflets with
name, activeFrom/activeTo, a PDF (api.marketdino.pl) and pages[]; every page
has a WebP image and `hotspots[]` with {ean, product:{name, price, slug},
xPosition, yPosition} in percent. So Dino needs neither OCR nor a vision
model – hotspots are the offers. Verified 2026-11-16.
"""
from __future__ import annotations

from datetime import datetime

from ..http import get_json
from ..models import Leaflet

LIST_PAGE = "https://marketdino.pl/gazetki/lista/standard"
PAYLOAD = LIST_PAGE + "/_payload.json"


def devalue(payload: list):
    """Decode Nuxt's `devalue` format: a flat list where ints are references."""
    cache: dict[int, object] = {}

    def resolve(i):
        if i in cache:
            return cache[i]
        v = payload[i]
        if isinstance(v, list):
            if v and isinstance(v[0], str) and v[0] in ("Reactive", "ShallowReactive", "Ref", "ShallowRef"):
                out = resolve(v[1])
                cache[i] = out
                return out
            out_l: list = []
            cache[i] = out_l
            out_l.extend(resolve(x) for x in v)
            return out_l
        if isinstance(v, dict):
            out_d: dict = {}
            cache[i] = out_d
            for k, x in v.items():
                out_d[k] = resolve(x)
            return out_d
        cache[i] = v
        return v

    return resolve(0)


def _dt(s: str | None):
    return datetime.fromisoformat(s).date() if s else None


def leaflet_from_entry(e: dict) -> Leaflet:
    pages = sorted(e.get("pages") or [], key=lambda p: p.get("no", 0))
    products = []
    for p in pages:
        for h in p.get("hotspots") or []:
            prod = h.get("product") or {}
            if not prod.get("name") or h.get("isDisplayed") is False:
                continue
            products.append(
                {
                    "page_no": p.get("no"),
                    "name": prod.get("name"),
                    "price": prod.get("price"),
                    "ean": h.get("ean"),
                    "slug": prod.get("slug"),
                    "x": h.get("xPosition"),
                    "y": h.get("yPosition"),
                }
            )
    pdf = (e.get("pdf") or {}).get("file")
    return Leaflet(
        id=f"dino:{e['id']}",
        store="dino",
        title=e.get("name") or "Gazetka Dino",
        valid_from=_dt(e.get("activeFrom")) or _dt(e.get("displayedFrom")),
        valid_to=_dt(e.get("activeTo")) or _dt(e.get("displayedTo")),
        source_url=LIST_PAGE,
        pdf_url=pdf,
        page_image_urls=[(p.get("file") or {}).get("file") or "" for p in pages],
        pages=len(pages),
        is_food=True,
        extra={
            "thumbnail_url": ((pages[0].get("file") or {}).get("file") if pages else None),
            "products": products,
            "one_day_offer": e.get("oneDayOffer"),
            "hotspots_enabled": e.get("hotspotsEnabled"),
            "text": e.get("text"),
        },
    )


def list_leaflets() -> list[Leaflet]:
    data = devalue(get_json(PAYLOAD))
    lists = (data.get("data") or {}).get("leaflets-list") or {}
    entries = []
    for key in ("standard", "alcohol"):
        entries.extend(lists.get(key) or [])
    return [leaflet_from_entry(e) for e in entries if e.get("id")]
