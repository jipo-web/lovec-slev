"""Pre-cut product images for the cards on the web.

The web used to cut the product out of the full flyer page in the browser
(CSS positioning of the page image). Every card then downloaded a whole page
(0.2–1.7 MB), the crop was blurry and it broke whenever a store re-published
its images. Instead the pipeline cuts each offer once:

* the box is the product photo alone (`photo_bbox` from the locate pass),
  or – when there is none – the whole tile, widened to a readable shape,
* the source is the sharpest image the store offers (Lidl/Kaufland "zoom"
  2400 px instead of 1200 px; Biedronka and Dino are already large),
* the result is a WebP of at most 520 px on the longer side (≈ 15 kB).

Files are content-addressed (hash of source image + box), so a crop is made
once and reused while the offer lives; `data/media` is kept between runs by the
workflow cache. `offer_images` maps offer id → file for the build.
"""
from __future__ import annotations

import hashlib
import shutil
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

from .config import CACHE_DIR, DATA_DIR, OUT_DIR
from .db import all_offers, row_to_leaflet
from .http import download
from .models import Offer

MEDIA_DIR = DATA_DIR / "media"  # all crops (kept between runs)
WEB_MEDIA_DIR = OUT_DIR.parent / "media"  # crops of the offers on the web (public/media)
MAX_SIDE = 520
QUALITY = 80

PHOTO_PAD = 0.04  # of the photo box size – keeps a thin margin around the packshot
TILE_PAD = 0.015  # of the page – same as the web fallback
MIN_ASPECT, MAX_ASPECT = 0.65, 2.2  # tile crops only

_SCHEMA = """
CREATE TABLE IF NOT EXISTS offer_images (
  offer_id TEXT PRIMARY KEY,
  path TEXT NOT NULL,           -- relative to the site root, e.g. media/lidl/ab12….webp
  kind TEXT NOT NULL            -- photo | tile
);
"""


def ensure_schema(con: sqlite3.Connection) -> None:
    con.executescript(_SCHEMA)


def _clamp(v: float) -> float:
    return min(1.0, max(0.0, v))


def crop_box(o: Offer, page_w: int, page_h: int) -> tuple[list[float], str] | None:
    """Box in page fractions and its kind, or None when the offer has nothing usable."""
    if o.photo_bbox:
        x0, y0, x1, y1 = o.photo_bbox
        px, py = (x1 - x0) * PHOTO_PAD, (y1 - y0) * PHOTO_PAD
        return [_clamp(x0 - px), _clamp(y0 - py), _clamp(x1 + px), _clamp(y1 + py)], "photo"
    if not o.bbox:
        return None
    x0, y0, x1, y1 = o.bbox
    x0, y0, x1, y1 = _clamp(x0 - TILE_PAD), _clamp(y0 - TILE_PAD), _clamp(x1 + TILE_PAD), _clamp(y1 + TILE_PAD)
    w, h = x1 - x0, y1 - y0
    if w < 0.04 or h < 0.03 or (w > 0.95 and h > 0.95):
        return None

    def grow(lo: float, hi: float, size: float) -> tuple[float, float]:
        c = (lo + hi) / 2
        a = max(0.0, c - size / 2)
        z = min(1.0, a + size)
        return max(0.0, z - size), z

    aspect = (w * page_w) / (h * page_h)
    if aspect < MIN_ASPECT:
        x0, x1 = grow(x0, x1, min(1.0, h * page_h * MIN_ASPECT / page_w))
    elif aspect > MAX_ASPECT:
        y0, y1 = grow(y0, y1, min(1.0, w * page_w / MAX_ASPECT / page_h))
    return [x0, y0, x1, y1], "tile"


def _key(src: str, kind: str, box: list[float]) -> str:
    """Bump the version suffix when the cutting rules change, to re-cut everything."""
    return hashlib.sha1(f"{src}|{kind}|{[round(v, 4) for v in box]}|{MAX_SIDE}|v1".encode()).hexdigest()[:16]


def cut(page: "Image.Image", box: list[float], dest: Path) -> None:  # noqa: F821
    from PIL import Image

    W, H = page.size
    x0, y0, x1, y1 = round(box[0] * W), round(box[1] * H), round(box[2] * W), round(box[3] * H)
    im = page.crop((x0, y0, max(x1, x0 + 1), max(y1, y0 + 1)))
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")
    im.save(tmp, "WEBP", quality=QUALITY, method=6)
    tmp.replace(dest)


def _page_cache(store: str, url: str) -> Path:
    return CACHE_DIR / "hires" / store / (hashlib.sha1(url.encode()).hexdigest()[:16] + Path(url.split("?")[0]).suffix[:5])


def make_crops(con: sqlite3.Connection, today: date | None = None, horizon_days: int = 14) -> dict:
    """Cut a WebP for every offer on the web that has a box. Returns counters."""
    from PIL import Image

    ensure_schema(con)
    today = today or date.today()
    until = (today + timedelta(days=horizon_days)).isoformat()
    offers = [o for o in all_offers(con, "valid_to>=? AND valid_from<=?", (today.isoformat(), until))
              if o.page_image_url and (o.photo_bbox or o.bbox)]
    zoom: dict[str, str] = {}
    for r in con.execute("SELECT * FROM leaflets WHERE valid_to>=?", (today.isoformat(),)):
        zoom.update(row_to_leaflet(r).extra.get("zoom_urls") or {})

    by_src: dict[str, list[Offer]] = {}
    for o in offers:
        by_src.setdefault(zoom.get(o.page_image_url, o.page_image_url), []).append(o)

    stats = {"photo": 0, "tile": 0, "new": 0, "failed_pages": 0}
    rows: list[tuple[str, str, str]] = []
    for src, page_offers in by_src.items():
        store = page_offers[0].store
        page = None
        try:
            for o in page_offers:
                kind = "photo" if o.photo_bbox else "tile"
                # The name depends only on the source and the detected box, so an existing
                # crop is found without downloading the page.
                rel = f"media/{store}/{_key(src, kind, o.photo_bbox or o.bbox)}.webp"
                dest = DATA_DIR / rel
                if not dest.exists():
                    if page is None:
                        page = Image.open(download(src, _page_cache(store, src))).convert("RGB")
                    spec = crop_box(o, *page.size)
                    if not spec:
                        continue
                    cut(page, spec[0], dest)
                    stats["new"] += 1
                rows.append((o.id, rel, kind))
                stats[kind] += 1
        except Exception as e:
            print(f"[{store}] crops failed for {src}: {e}", file=sys.stderr)
            stats["failed_pages"] += 1
        finally:
            if page is not None:
                page.close()

    con.execute("DELETE FROM offer_images")
    con.executemany("INSERT OR REPLACE INTO offer_images (offer_id, path, kind) VALUES (?,?,?)", rows)
    con.commit()

    # Prune crops nobody uses any more (expired offers, superseded boxes).
    used = {DATA_DIR / r[1] for r in rows}
    for f in MEDIA_DIR.rglob("*.webp") if MEDIA_DIR.exists() else []:
        if f not in used:
            f.unlink()
    return stats


def offer_images(con: sqlite3.Connection) -> dict[str, str]:
    ensure_schema(con)
    return {r[0]: r[1] for r in con.execute("SELECT offer_id, path FROM offer_images")}


def publish(paths: set[str]) -> None:
    """Copy the crops used on the web into public/media (a clean copy every build)."""
    if WEB_MEDIA_DIR.exists():
        shutil.rmtree(WEB_MEDIA_DIR)
    WEB_MEDIA_DIR.mkdir(parents=True)  # always present: the workflow uploads it with public/data
    for rel in paths:
        src = DATA_DIR / rel
        if src.exists():
            dest = OUT_DIR.parent / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)


