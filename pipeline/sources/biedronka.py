"""Biedronka – leaflets are served as page images by a JSON API.

Discovery: https://www.biedronka.pl/pl/gazetki lists tiles linking to
    https://www.biedronka.pl/pl/press,id,<slug id>,title,<slug>
The leaflet page embeds `window.galleryLeaflet.init("<uuid>")`; then
    https://leaflet-api.prod.biedronka.cloud/api/leaflets/<uuid>?ctx=web
returns {images_mobile: [{page, image}], images_desktop: [...], format}.
No title/validity in the API; "od DD-MM" comes from the slug, the end date is
estimated from Biedronka's cycle (Mon→Sat, Thu→Wed). Verified 2026-11-16.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from ..config import NON_FOOD_TITLE_HINTS
from ..http import get_json, get_text
from ..models import Leaflet

LIST_URL = "https://www.biedronka.pl/pl/gazetki"
API = "https://leaflet-api.prod.biedronka.cloud/api/leaflets/{id}?ctx=web"
_TILE_RE = re.compile(r'href="(https://www\.biedronka\.pl/pl/press(?:adult)?,id,([a-z0-9]+),title,([^"#]+))')
_INIT_RE = re.compile(r'galleryLeaflet\.init\("([0-9a-f-]{36})"')
_DATE_RE = re.compile(r"(?:od-|-)(\d{1,2})-(\d{1,2})(?:-(\d{4}))?(?:-|$)")
_TITLE_RE = re.compile(r"<title>([^<]*?)\s*-\s*Gazetka", re.I)

# Food leaflets we extract offers from. Everything else is listed only.
FOOD_SLUG_HINTS = ("codziennie-niskie-ceny", "hity-i-inspiracje", "oferta", "spozywcz", "gang", "weekend")


def _dates_from_slug(slug: str, today: date) -> tuple[date, date, bool]:
    m = _DATE_RE.search(slug)
    if not m:
        return today, today + timedelta(days=6), True
    d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
    year = int(y) if y else today.year
    vf = date(year, mo, d)
    if not y and (vf - today).days > 200:  # slug from last December seen in January
        vf = date(year - 1, mo, d)
    elif not y and (today - vf).days > 200:
        vf = date(year + 1, mo, d)
    span = {0: 5, 3: 6}.get(vf.weekday(), 6)  # Monday → Saturday, Thursday → Wednesday
    return vf, vf + timedelta(days=span), True


def _is_food(slug: str) -> bool:
    s = slug.lower()
    if any(h in s for h in NON_FOOD_TITLE_HINTS):
        return False
    return any(h in s for h in FOOD_SLUG_HINTS)


def list_leaflets(today: date | None = None) -> list[Leaflet]:
    today = today or date.today()
    html = get_text(LIST_URL)
    out: list[Leaflet] = []
    seen: set[str] = set()
    for page_url, slug_id, slug in _TILE_RE.findall(html):
        if slug_id in seen:
            continue
        seen.add(slug_id)
        try:
            page = get_text(page_url)
        except Exception as e:  # pragma: no cover - network
            print(f"[biedronka] page failed {page_url}: {e}")
            continue
        m = _INIT_RE.search(page)
        if not m:
            continue
        uuid = m.group(1)
        try:
            data = get_json(API.format(id=uuid))
        except Exception as e:  # pragma: no cover - network
            print(f"[biedronka] api failed {uuid}: {e}")
            continue
        pages = sorted(data.get("images_mobile") or [], key=lambda p: p.get("page", 0))
        images = [p["image"] for p in pages if p.get("image")]
        t = _TITLE_RE.search(page)
        title = (t.group(1).strip() if t else slug.replace("-", " ")).replace(" P -", " -")
        vf, vt, estimated = _dates_from_slug(slug, today)
        variant = "z ladą tradycyjną" if re.search(r"-p(-|$)", slug) or " P " in f" {title} " else None
        out.append(
            Leaflet(
                id=f"biedronka:{uuid}",
                store="biedronka",
                title=title,
                valid_from=vf,
                valid_to=vt,
                source_url=page_url,
                pdf_url=None,
                page_image_urls=images,
                pages=len(images),
                variant=variant,
                is_food=_is_food(slug),
                extra={
                    "slug": slug,
                    "slug_id": slug_id,
                    "format": data.get("format"),
                    "valid_to_estimated": estimated,
                    "thumbnail_url": images[0] if images else None,
                },
            )
        )
    return out
