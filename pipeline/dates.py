"""Per-offer validity.

Leaflets often run for a week, but parts of them only for some days: a page
section headed "CZWARTEK – SOBOTA 12.11-14.11" or a tile saying "TYLKO W
PONIEDZIAŁEK 16.11". Without this every offer inherited the whole leaflet's
dates and stayed on the web after the deal had ended.

Sources, strongest first:
1. a date printed in the offer's own text (conditions / discount),
2. the date banner of the page section the offer sits in (page_dates table,
   filled by extract/page_dates.py),
3. the leaflet's validity.
"""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import date, timedelta

MAX_SPAN_DAYS = 62

_D = r"(\d{1,2})"
_M = r"(\d{1,2})"
_Y = r"(?:[./](\d{2,4}))?"
_DATE = rf"{_D}\s*[./]\s*{_M}{_Y}\.?"
_DASH = r"\s*(?:-|–|—|do)\s*"

# "12.11-14.11", "16.11.2026 – 21.11.2026", "od 16.11 do sob., 21.11"
_RANGE = re.compile(rf"{_DATE}{_DASH}(?:[a-ząćęłńóśźż]+\.?,?\s*)?{_DATE}", re.I)
# "12-14.11", "12.–14.11."
_RANGE_SAME_MONTH = re.compile(rf"(?<![\d.]){_D}\.?{_DASH}{_D}\s*[./]\s*{_M}{_Y}(?![\d,])", re.I)
# "tylko w poniedziałek 16.11", "od 16.11", "do 21.11", "w sobotę 14.11", "ważny do 2.12.2026"
_SINGLE = re.compile(
    rf"\b(tylko|od|do|w|we|wa[zż]n[aey]?\s+(?:od|do))\b\s*(?:[a-ząćęłńóśźż]+\.?,?\s*)?{_DATE}", re.I)

def _mk(day: str, month: str, year: str | None, ref: date) -> date | None:
    d, m = int(day), int(month)
    if not (1 <= d <= 31 and 1 <= m <= 12):
        return None
    if year:
        y = int(year)
        y = y + 2000 if y < 100 else y
    else:
        # Closest year to the leaflet: "2.01" in a December leaflet is next year.
        y = ref.year
        if m - ref.month > 6:
            y -= 1
        elif ref.month - m > 6:
            y += 1
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _near(a: date, b: date, ref_from: date, ref_to: date) -> bool:
    """Guards against volumes like "1.5-2.5 l": a real validity overlaps the
    leaflet's or starts at most a month after it."""
    return b >= ref_from - timedelta(days=7) and a <= ref_to + timedelta(days=31)


def parse_valid_text(text: str | None, ref_from: date, ref_to: date) -> tuple[date, date] | None:
    """Validity printed in `text`, or None. `ref_*` is the leaflet's validity
    (used for the year and to fill open ends such as "od 16.11")."""
    if not text:
        return None
    t = " ".join(text.split())
    ref = ref_from

    for rx, groups in ((_RANGE, (0, 1, 2, 3, 4, 5)), (_RANGE_SAME_MONTH, None)):
        for m in rx.finditer(t):
            if groups:
                d1, m1, y1, d2, m2, y2 = m.groups()
                a, b = _mk(d1, m1, y1 or y2, ref), _mk(d2, m2, y2, ref)
            else:
                d1, d2, mo, y = m.groups()
                a, b = _mk(d1, mo, y, ref), _mk(d2, mo, y, ref)
            if a and b and a <= b and (b - a).days <= MAX_SPAN_DAYS and _near(a, b, ref_from, ref_to):
                return a, b

    for m in _SINGLE.finditer(t):
        kw = m.group(1).lower()
        d = _mk(m.group(2), m.group(3), m.group(4), ref)
        if not d or not _near(d, d, ref_from, ref_to):
            continue
        if kw.endswith("od") or kw == "od":
            if d <= ref_to:
                return d, ref_to
        elif kw.endswith("do") or kw == "do":
            if d >= ref_from:
                return ref_from, d
        else:  # "tylko 16.11", "w sobotę 14.11" – that single day
            return d, d
    return None


# --------------------------------------------------------- page sections

_SCHEMA = """
CREATE TABLE IF NOT EXISTS page_dates (
  leaflet_id TEXT NOT NULL,
  page_no INTEGER NOT NULL,
  regions_json TEXT NOT NULL,      -- [{"valid_text": "...", "bbox": [x0,y0,x1,y1]}], [] = page has no date banner
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (leaflet_id, page_no)
);
"""


def ensure_schema(con: sqlite3.Connection) -> None:
    con.executescript(_SCHEMA)


def page_regions(con: sqlite3.Connection, leaflet_id: str, page_no: int) -> list[dict]:
    ensure_schema(con)
    row = con.execute("SELECT regions_json FROM page_dates WHERE leaflet_id=? AND page_no=?",
                      (leaflet_id, page_no)).fetchone()
    return json.loads(row[0]) if row else []


AREA_MIN = 0.05  # a region covering at least 5 % of the page is an area, smaller ones are labels/banners


def _area(b: list[float]) -> float:
    return (b[2] - b[0]) * (b[3] - b[1])


def _inside(x: float, y: float, b: list[float], pad: float = 0.01) -> bool:
    return b[0] - pad <= x <= b[2] + pad and b[1] - pad <= y <= b[3] + pad


def region_for(bbox: list[float] | None, regions: list[dict]) -> dict | None:
    """Date region that applies to an offer whose tile is `bbox`.

    The model answers in three shapes, all seen on real pages:
    1. a label printed on the product tile ("OFERTA OD 16.11 DO 18.11") –
       its box lies inside the tile,
    2. an area of the page – the tile's centre lies inside it,
    3. only the section banner ("CZWARTEK – SOBOTA 12.11-14.11") – it applies
       to tiles below it, up to the next banner.
    Regions passed here should already be parseable dates.
    """
    if not bbox or not regions:
        return None
    boxed = [r for r in regions if r.get("bbox") and len(r["bbox"]) == 4]
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2

    # 1. label on the tile itself
    labels = [r for r in boxed if _area(r["bbox"]) < AREA_MIN
              and _inside((r["bbox"][0] + r["bbox"][2]) / 2, (r["bbox"][1] + r["bbox"][3]) / 2, bbox)]
    if labels:
        return min(labels, key=lambda r: _area(r["bbox"]))

    # 2. area containing the tile's centre
    areas = [r for r in boxed if _area(r["bbox"]) >= AREA_MIN and _inside(cx, cy, r["bbox"])]
    if areas:
        return min(areas, key=lambda r: _area(r["bbox"]))

    # 3. nearest banner above the tile that overlaps it horizontally and does not sit on another tile
    above = [r for r in boxed if _area(r["bbox"]) < AREA_MIN
             and (r["bbox"][1] + r["bbox"][3]) / 2 <= cy and not r.get("_on_tile")]
    overlapping = [r for r in above if min(r["bbox"][2], bbox[2]) - max(r["bbox"][0], bbox[0]) > 0]
    if overlapping or above:  # prefer a banner over the tile's column, else the nearest one above
        return max(overlapping or above, key=lambda r: r["bbox"][3])
    return None


def offer_validity(offer_text: str | None, bbox: list[float] | None, regions: list[dict],
                   lf_from: date, lf_to: date, tiles: list[list[float]] | None = None) -> tuple[date, date]:
    """Validity of one offer (see module docstring for the order of sources).
    `tiles` are the boxes of all offers on the page: a label sitting on some
    other product's tile must not act as a section banner for this one."""
    own = parse_valid_text(offer_text, lf_from, lf_to)
    if own:
        return own
    usable = []
    for r in regions:
        parsed = parse_valid_text(r.get("valid_text"), lf_from, lf_to)
        if not parsed:
            continue
        rb = r.get("bbox")
        on_tile = bool(rb and tiles and _area(rb) < AREA_MIN and any(
            _inside((rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2, t) for t in tiles))
        usable.append({**r, "_parsed": parsed, "_on_tile": on_tile})
    reg = region_for(bbox, usable)
    if reg:
        return reg["_parsed"]
    # One distinct date on the whole page and no way to place it: it covers the page.
    dates = {r["_parsed"] for r in usable}
    if len(dates) == 1 and not any(r.get("bbox") for r in usable):
        return dates.pop()
    return lf_from, lf_to
