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


def region_for(bbox: list[float] | None, regions: list[dict]) -> dict | None:
    """Smallest date region containing the centre of the offer's tile."""
    if not bbox or not regions:
        return None
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    best, best_area = None, 9.0
    for r in regions:
        b = r.get("bbox")
        if not b or len(b) != 4:
            continue
        if b[0] - 0.01 <= cx <= b[2] + 0.01 and b[1] - 0.01 <= cy <= b[3] + 0.01:
            area = (b[2] - b[0]) * (b[3] - b[1])
            if area < best_area:
                best, best_area = r, area
    return best


def offer_validity(offer_text: str | None, bbox: list[float] | None, regions: list[dict],
                   lf_from: date, lf_to: date) -> tuple[date, date]:
    """Validity of one offer (see module docstring for the order of sources)."""
    own = parse_valid_text(offer_text, lf_from, lf_to)
    if own:
        return own
    reg = region_for(bbox, regions)
    if reg:
        parsed = parse_valid_text(reg.get("valid_text"), lf_from, lf_to)
        if parsed:
            return parsed
    # A page with exactly one banner and no usable boxes: the banner covers the page.
    texts = {r.get("valid_text") for r in regions if r.get("valid_text")}
    if len(texts) == 1 and not any(r.get("bbox") for r in regions):
        parsed = parse_valid_text(texts.pop(), lf_from, lf_to)
        if parsed:
            return parsed
    return lf_from, lf_to

