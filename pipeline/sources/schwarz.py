"""Schwarz Group leaflet platform – shared by Lidl and Kaufland.

Discovery: the ESI overview fragment that the store websites embed
    https://esi.leaflets.schwarz/overview?client_locale=lidl%2Fpl-PL&region_id=0&store_id=0
    https://esi.leaflets.schwarz/overview?client_locale=kaufland%2Fpl-PL&region_id=0
lists every current leaflet as <a class="flyer" id="flyer-<uuid>" data-track-name="…">.

Detail: https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=<uuid>&region_code=<r>
returns validity, pdfUrl, pages[] (each with image URL and a `keyWords` text dump)
and, for Lidl, a products{} map for non-food items. Verified 2026-11-16.
"""
from __future__ import annotations

import re
from datetime import date

from ..config import NON_FOOD_TITLE_HINTS, SCHWARZ_API
from ..http import get_json, get_text
from ..models import Leaflet

ESI_OVERVIEW = "https://esi.leaflets.schwarz/overview"
_FLYER_RE = re.compile(r'id="flyer-([0-9a-f-]{36})"[^>]*?data-track-name="([^"]*)"', re.S)


def _unescape(s: str) -> str:
    return re.sub(r"&#x([0-9a-f]+);", lambda m: chr(int(m.group(1), 16)), s).replace("&amp;", "&")


def discover_ids(client_locale: str, region_id: str, store_id: str | None = "0") -> list[tuple[str, str]]:
    params = f"client_locale={client_locale.replace('/', '%2F')}&region_id={region_id}"
    if store_id is not None:
        params += f"&store_id={store_id}"
    html = get_text(f"{ESI_OVERVIEW}?{params}")
    seen: dict[str, str] = {}
    for fid, name in _FLYER_RE.findall(html):
        seen.setdefault(fid, _unescape(name))
    return list(seen.items())


def flyer_detail(flyer_id: str, region_code: str = "0") -> dict:
    return get_json(f"{SCHWARZ_API}/flyer?flyer_identifier={flyer_id}&region_code={region_code}")["flyer"]


def is_food(name: str, title: str, category: str) -> bool:
    """Weekly 'Gazetka' / 'Mocny Start' style leaflets are food; catalogues are not."""
    text = f"{name} {title}".lower()
    if text.startswith("gazetka") or "mocny start" in text or "oferta" in text:
        return True
    return not any(h in text for h in NON_FOOD_TITLE_HINTS)


def to_leaflet(store: str, flyer: dict) -> Leaflet:
    name = flyer.get("name") or "Gazetka"
    title = flyer.get("title") or ""
    pages = flyer.get("pages") or []
    vf = date.fromisoformat(flyer.get("offerStartDate") or flyer["startDate"])
    vt = date.fromisoformat(flyer.get("offerEndDate") or flyer["endDate"])
    return Leaflet(
        id=f"{store}:{flyer['id']}",
        store=store,  # type: ignore[arg-type]
        title=f"{name} {title}".strip(),
        valid_from=vf,
        valid_to=vt,
        source_url=flyer.get("flyerUrlAbsolute") or flyer.get("quitUrl") or "",
        pdf_url=flyer.get("hiResPdfUrl") or flyer.get("pdfUrl"),
        page_image_urls=[p.get("image") or "" for p in pages],
        pages=len(pages),
        region=str((flyer.get("regions") or [{}])[0].get("code", "0")),
        is_food=is_food(name, title, flyer.get("category", "")),
        extra={
            "thumbnail_url": flyer.get("publicThumbnail") or flyer.get("thumbnailUrl"),
            "status": flyer.get("status"),
            "category": flyer.get("category"),
            # keyWords is the page's text dump – useful as a cheap sanity check
            "page_keywords": [p.get("keyWords") or "" for p in pages],
            "products": list((flyer.get("products") or {}).values()),
        },
    )


def list_leaflets(store: str, client_locale: str, region_code: str, store_id: str | None) -> list[Leaflet]:
    out: list[Leaflet] = []
    for fid, _name in discover_ids(client_locale, region_code, store_id):
        try:
            flyer = flyer_detail(fid, region_code)
        except Exception as e:  # pragma: no cover - network
            print(f"[{store}] detail failed for {fid}: {e}")
            continue
        if flyer.get("status") not in (None, "current", "upcoming"):
            continue
        out.append(to_leaflet(store, flyer))
    return out
