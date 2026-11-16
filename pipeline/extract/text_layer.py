"""Rule-based extraction from a PDF text layer (Lidl / Kaufland PDFs).

The text layer gives words with coordinates. Prices are printed as large
numbers ("4", "99" as separate spans, or "4,99"); product names sit above or
left of the price. We cluster price tokens, then attach the nearest text
block above them. This is deliberately conservative: anything ambiguous is
left to the vision model (see `pages_needing_vision`).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import pymupdf

from ..models import RawOffer

PRICE_RE = re.compile(r"^(\d{1,3})[,.](\d{2})$")
GROSZE_RE = re.compile(r"^\d{2}$")
ZL_RE = re.compile(r"^\d{1,3}$")
NOISE = {"zł", "zl", "PLN", "szt", "szt.", "kg", "l", "g", "ml", "/", "za", "cena", "Cena"}
MIN_PRICE_FONT = 14.0  # promo prices are printed big; unit prices small


@dataclass
class Span:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    size: float

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2


def page_spans(page: pymupdf.Page) -> list[Span]:
    spans: list[Span] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line.get("spans", []):
                t = s["text"].strip()
                if t:
                    x0, y0, x1, y1 = s["bbox"]
                    spans.append(Span(t, x0, y0, x1, y1, s["size"]))
    return spans


def has_text_layer(doc: pymupdf.Document, sample: int = 5) -> bool:
    n = min(sample, len(doc))
    return sum(len(doc[i].get_text("text").strip()) > 200 for i in range(n)) >= max(1, n // 2)


def find_prices(spans: list[Span]) -> list[tuple[float, Span, Span]]:
    """Return (price, anchor span, last span) for big printed prices."""
    out = []
    big = [s for s in spans if s.size >= MIN_PRICE_FONT]
    used: set[int] = set()
    for i, s in enumerate(big):
        if i in used:
            continue
        m = PRICE_RE.match(s.text.replace(" ", ""))
        if m:
            out.append((int(m.group(1)) + int(m.group(2)) / 100, s, s))
            continue
        if ZL_RE.match(s.text):
            # look for grosze span to the right, slightly higher, smaller or equal font
            for j, g in enumerate(big):
                if j == i or j in used or not GROSZE_RE.match(g.text):
                    continue
                if 0 <= g.x0 - s.x1 < s.size * 1.2 and abs(g.y0 - s.y0) < s.size * 1.2 and g.size <= s.size:
                    out.append((int(s.text) + int(g.text) / 100, s, g))
                    used.add(j)
                    break
    return out


def name_above(price: Span, spans: list[Span], page_w: float) -> str | None:
    """Collect small-font text in a column above the price, closest first."""
    col_w = max(page_w * 0.18, price.size * 6)
    cands = [
        s for s in spans
        if s.size < MIN_PRICE_FONT and s.text not in NOISE and len(s.text) > 2
        and abs(s.cx - price.cx) < col_w and 0 < price.y0 - s.y1 < price.size * 8
        and not PRICE_RE.match(s.text)
    ]
    if not cands:
        return None
    cands.sort(key=lambda s: (-s.y0, s.x0))
    lines: list[str] = []
    for s in cands[:4]:
        lines.insert(0, s.text)
    name = " ".join(lines)
    name = re.sub(r"\s+", " ", name).strip(" -–,.")
    return name if len(name) >= 4 else None


def extract_page(page: pymupdf.Page) -> list[RawOffer]:
    spans = page_spans(page)
    w, h = page.rect.width, page.rect.height
    offers: list[RawOffer] = []
    for price, anchor, last in find_prices(spans):
        name = name_above(anchor, spans, w)
        if not name:
            continue
        # old price: a small struck-through-looking number right next to the price
        old = None
        for s in spans:
            if s is anchor or s is last or s.size >= MIN_PRICE_FONT:
                continue
            if PRICE_RE.match(s.text) and abs(s.cy - anchor.cy) < anchor.size * 2 and abs(s.x0 - last.x1) < anchor.size * 4:
                old = s.text
                break
        unit_price = next(
            (s.text for s in spans if ("/kg" in s.text or "/l" in s.text or "= " in s.text)
             and abs(s.cx - anchor.cx) < w * 0.2 and 0 < s.y0 - anchor.y1 < anchor.size * 3),
            None,
        )
        bbox = [max(0, anchor.x0 - w * 0.1) / w, max(0, anchor.y0 - anchor.size * 8) / h,
                min(w, last.x1 + w * 0.05) / w, min(h, last.y1 + anchor.size * 2) / h]
        offers.append(RawOffer(name=name, price_text=f"{price:.2f}", old_price_text=old,
                               unit_price_text=unit_price, bbox=bbox))
    return offers


def extract_pdf(pdf_path: str, pages: list[int] | None = None) -> dict[int, list[RawOffer]]:
    """Return {page_no (1-based): offers}. Pages with no text layer return []."""
    doc = pymupdf.open(pdf_path)
    result: dict[int, list[RawOffer]] = {}
    idxs = pages or list(range(1, len(doc) + 1))
    for n in idxs:
        result[n] = extract_page(doc[n - 1])
    return result


def pages_needing_vision(doc_result: dict[int, list[RawOffer]], min_offers: int = 2) -> list[int]:
    return [n for n, offers in doc_result.items() if len(offers) < min_offers]
