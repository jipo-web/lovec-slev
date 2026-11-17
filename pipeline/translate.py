"""Czech product names for offers that only carry the Polish one.

New pages get `name_cs` straight from the vision model. Everything older (and
structured sources such as Dino) is translated here with one cheap text call
per batch of names. Results are cached in the `translations` table, so each
distinct Polish name is paid for once (≈ 0.01 CZK per 100 names with a
Flash-class model).
"""
from __future__ import annotations

import json
import sqlite3
import sys
import time
from datetime import date

import httpx

from .config import VISION_API_KEY, VISION_BASE_URL, VISION_MODEL

BATCH = 80
MAX_NAMES_PER_RUN = 3000

PROMPT = """Přelož názvy potravin a zboží z polských letáků do češtiny.
Pravidla: krátce a přirozeně, jak by to stálo na české cenovce; značky, názvy odrůd
a čísla (gramáže, procenta) ponech beze změny; nic nevysvětluj.
Vrať výhradně JSON objekt {"t": [...]} se stejným počtem položek ve stejném pořadí.

Názvy:
"""

_SCHEMA = """
CREATE TABLE IF NOT EXISTS translations (
  name_pl TEXT PRIMARY KEY,
  name_cs TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _call(names: list[str], model: str) -> list[str] | None:
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": PROMPT + json.dumps(names, ensure_ascii=False)}],
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
    content = r.json()["choices"][0]["message"]["content"]
    content = content.strip().removeprefix("```json").removesuffix("```").strip()
    out = json.loads(content).get("t")
    if not isinstance(out, list) or len(out) != len(names) or not all(isinstance(x, str) for x in out):
        return None  # misaligned answer – better no translation than a wrong one
    return [x.strip() for x in out]


def apply_cached(con: sqlite3.Connection) -> int:
    """Copy cached translations onto offers that still show the Polish name."""
    cur = con.execute(
        "UPDATE offers SET name = (SELECT name_cs FROM translations t WHERE t.name_pl = offers.name_pl) "
        "WHERE name = name_pl AND EXISTS (SELECT 1 FROM translations t WHERE t.name_pl = offers.name_pl)")
    return cur.rowcount


def translate_names(con: sqlite3.Connection, model: str | None = None) -> int:
    """Translate missing names (current offers only). Returns the number of offers updated."""
    con.executescript(_SCHEMA)
    model = model or VISION_MODEL
    if not VISION_API_KEY:
        print("translate: no API key, using cached translations only", file=sys.stderr)
        return apply_cached(con)

    # Names the vision model already translated are free cache entries.
    con.execute("INSERT OR IGNORE INTO translations (name_pl, name_cs, model) "
                "SELECT name_pl, name, 'vision' FROM offers WHERE name != name_pl")
    todo = [r[0] for r in con.execute(
        "SELECT DISTINCT o.name_pl FROM offers o LEFT JOIN translations t ON t.name_pl = o.name_pl "
        "WHERE o.name = o.name_pl AND t.name_pl IS NULL AND o.valid_to >= ? ORDER BY o.name_pl",
        (date.today().isoformat(),))][:MAX_NAMES_PER_RUN]

    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        try:
            out = _call(chunk, model)
        except Exception as e:  # never fail the daily run because of names
            print(f"translate: batch {i // BATCH} failed: {e}", file=sys.stderr)
            continue
        if not out:
            print(f"translate: batch {i // BATCH} misaligned, skipped", file=sys.stderr)
            continue
        con.executemany("INSERT OR REPLACE INTO translations (name_pl, name_cs, model) VALUES (?, ?, ?)",
                        [(pl, cs, model) for pl, cs in zip(chunk, out) if cs])
        con.commit()
    return apply_cached(con)
