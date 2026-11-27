"""gazetkipromocyjne.net – mirror of Polish store leaflets (fallback source).

Since 26 Nov 2026 Kaufland no longer lists any leaflet in the national edition
(region 0) of the Schwarz platform, and kaufland.pl blocks datacenter IPs. This
site publishes the same leaflets as page images (908 × 1280 px JPEG) and PDF:

    https://www.gazetkipromocyjne.net/kaufland/

Each leaflet is a card:
    <div class="newspapper gp-leaflet-card" data-items="[{"w":908,"h":1280,"src":"/wp-content/uploads/pdf/cache/<key>/1.jpg"}, {"html": "<ad>"}, …]">
      <button rel="#id117465" aria-label="Przeglądaj gazetkę Kaufland, 26/11/2026 – 02/12/2026, Kaufland Gazetka Tygodnia">
    … href="https://www.gazetkipromocyjne.net/wp-content/uploads/pdf/<key>.pdf"
Ended leaflets carry "Oferta zakończona" in the label. Verified 2026-11-27.
"""
from __future__ import annotations

import html as htmlmod
import json
import re
from datetime import date, datetime

from ..http import get_text
from ..models import Leaflet

BASE = "https://www.gazetkipromocyjne.net"

_CARD = re.compile(r'<div class="newspapper gp-leaflet-card"[^>]*?data-items="([^"]*)"(.*?)'
                   r'<button type="button" rel="#id(\d+)"[^>]*?aria-label="([^"]*)"', re.S)
_LABEL = re.compile(r"(\d{2})/(\d{2})/(\d{4})\s*[–-]\s*(\d{2})/(\d{2})/(\d{4})(?:,\s*(.*))?$")
_PDF = re.compile(r'href="(https://www\.gazetkipromocyjne\.net/wp-content/uploads/pdf/[^"]+\.pdf)"')


def parse_store_page(page: str, store: str, slug: str, food_titles: tuple[str, ...]) -> list[Leaflet]:
    """All leaflets on a store page that have not ended yet (by the printed dates)."""
    out: list[Leaflet] = []
    for items_attr, _between, gp_id, label in _CARD.findall(page):
        label = htmlmod.unescape(label)
        m = _LABEL.search(label)
        if not m or "zakończona" in label.lower():
            continue
        d1, m1, y1, d2, m2, y2, title = m.groups()
        vf, vt = date(int(y1), int(m1), int(d1)), date(int(y2), int(m2), int(d2))
        title = (title or "Gazetka").strip()
        try:
            items = json.loads(htmlmod.unescape(items_attr))
        except ValueError:
            continue
        pages = [BASE + it["src"] if it["src"].startswith("/") else it["src"]
                 for it in items if isinstance(it, dict) and it.get("src")]
        if not pages:
            continue
        tail = page[page.find(f'id="id{gp_id}"'):][:4000]
        pdf = _PDF.search(tail)
        out.append(Leaflet(
            id=f"{store}:gp-{gp_id}",
            store=store,  # type: ignore[arg-type]
            title=title,
            valid_from=vf,
            valid_to=vt,
            source_url=f"{BASE}/{slug}/#id{gp_id}",
            pdf_url=pdf.group(1) if pdf else None,
            page_image_urls=pages,
            pages=len(pages),
            region="0",
            is_food=any(t in title.lower() for t in food_titles),
            extra={"thumbnail_url": pages[0].rsplit("/", 1)[0] + "/cover.jpg",
                   "source": "gazetkipromocyjne.net"},
        ))
    return out


def list_leaflets(store: str, slug: str, food_titles: tuple[str, ...], today: date | None = None) -> list[Leaflet]:
    today = today or datetime.now().date()
    found = parse_store_page(get_text(f"{BASE}/{slug}/"), store, slug, food_titles)
    return [lf for lf in found if lf.valid_to >= today]
