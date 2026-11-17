"""Precise product tiles on a flyer page.

The main extraction reads ~15 fields per offer and the box it returns along
the way is often off: only the price tag, a neighbouring tile, or a sliver.
This pass asks for nothing but the boxes of products we already know from the
page, which models locate far more accurately (≈ 0.06 CZK per page with a
Flash-class model). Results are stored in `page_boxes` and override the box
from the main extraction during normalisation.
"""
from __future__ import annotations

import json
import re
import sqlite3
import time
from pathlib import Path

import httpx

from ..config import VISION_API_KEY, VISION_BASE_URL, VISION_MODEL
from .vision import _encode_image, box_2d_to_bbox

PROMPT = """To jest strona polskiej gazetki promocyjnej. Poniżej lista produktów, które są na tej stronie.
Dla KAŻDEGO produktu z listy znajdź jego kafelek i zwróć prostokąt box_2d = [ymin, xmin, ymax, xmax]
w skali 0–1000, który obejmuje CAŁY kafelek: zdjęcie produktu, jego nazwę i cenę (etykietę cenową).
Zasady:
- prostokąt ma obejmować zdjęcie produktu, nie tylko cenę lub tekst,
- nie obejmuj sąsiednich produktów,
- jeśli kilka produktów z listy dzieli jeden kafelek, mogą mieć ten sam prostokąt,
- jeśli produktu nie widać na stronie, pomiń go.
{hints}
Odpowiedz wyłącznie JSON: {{"boxes": [{{"id": 1, "box_2d": [ymin, xmin, ymax, xmax]}}]}}

Produkty:
{items}"""

_SCHEMA = """
CREATE TABLE IF NOT EXISTS page_boxes (
  leaflet_id TEXT NOT NULL,
  page_no INTEGER NOT NULL,
  boxes_json TEXT NOT NULL,        -- {"<raw index>": {"name": "...", "bbox": [x0,y0,x1,y1]}}
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (leaflet_id, page_no)
);
"""


def ensure_schema(con: sqlite3.Connection) -> None:
    con.executescript(_SCHEMA)


def page_boxes(con: sqlite3.Connection, leaflet_id: str, page_no: int) -> dict[int, dict]:
    ensure_schema(con)
    row = con.execute("SELECT boxes_json FROM page_boxes WHERE leaflet_id=? AND page_no=?",
                      (leaflet_id, page_no)).fetchone()
    return {int(k): v for k, v in json.loads(row[0]).items()} if row else {}


def build_prompt(products: list[dict]) -> str:
    """products: [{"id": int, "name": str, "price": str | None, "hint": (x, y) | None}]"""
    lines, has_hint = [], False
    for p in products:
        line = f'{p["id"]}. {p["name"]}'
        if p.get("price"):
            line += f' – {p["price"]}'
        if p.get("hint"):
            x, y = p["hint"]
            line += f' (punkt na kafelku: y={round(y * 1000)}, x={round(x * 1000)})'
            has_hint = True
        lines.append(line)
    hints = "- punkt podany przy produkcie leży na jego kafelku – kafelek musi go zawierać.\n" if has_hint else ""
    return PROMPT.format(hints=hints, items="\n".join(lines))


_ITEM = re.compile(r'"id"\s*:\s*"?(\d+)"?[^{}\[\]]*?"box_2d"\s*:\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*,'
                   r'\s*([\d.]+)\s*,\s*([\d.]+)\s*\]')


def _items(content: str) -> list:
    """The model's JSON is occasionally malformed (a missing comma, a stray
    quote). Fall back to pulling the id/box pairs out with a regex."""
    content = content.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        return json.loads(content).get("boxes") or []
    except (json.JSONDecodeError, AttributeError):
        return [{"id": m.group(1), "box_2d": [float(x) for x in m.groups()[1:]]} for m in _ITEM.finditer(content)]


def parse_answer(content: str, ids: set[int]) -> dict[int, list[float]]:
    out: dict[int, list[float]] = {}
    for it in _items(content):
        if not isinstance(it, dict):
            continue
        try:
            i = int(it.get("id"))
        except (TypeError, ValueError):
            continue
        b = box_2d_to_bbox(it.get("box_2d"))
        if i in ids and b and plausible_tile(b):
            out[i] = b
    return out


def plausible_tile(b: list[float]) -> bool:
    w, h = b[2] - b[0], b[3] - b[1]
    return 0.05 <= w <= 1.0 and 0.04 <= h <= 1.0 and w * h <= 0.7


def locate(path: Path, products: list[dict], *, model: str = VISION_MODEL) -> dict[int, list[float]]:
    if not VISION_API_KEY:
        raise RuntimeError("VISION_API_KEY / OPENROUTER_API_KEY is not set")
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": build_prompt(products)},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{_encode_image(path)}"}},
        ]}],
    }
    headers = {"Authorization": f"Bearer {VISION_API_KEY}", "HTTP-Referer": "https://github.com/jipo-web/lovec-slev",
               "X-Title": "lovec-slev"}
    for attempt in range(4):
        r = httpx.post(f"{VISION_BASE_URL}/chat/completions", headers=headers, json=body, timeout=120)
        if r.status_code == 429 and attempt < 3:
            time.sleep(min(float(r.headers.get("retry-after") or 20 * (attempt + 1)), 90))
            continue
        break
    r.raise_for_status()
    return parse_answer(r.json()["choices"][0]["message"]["content"], {p["id"] for p in products})
