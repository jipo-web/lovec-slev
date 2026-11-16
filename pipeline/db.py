"""SQLite persistence. One file, four tables, no ORM."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Iterator

from .config import DB_PATH
from .models import Leaflet, Offer

SCHEMA = """
CREATE TABLE IF NOT EXISTS leaflets (
  id TEXT PRIMARY KEY,
  store TEXT NOT NULL,
  title TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  source_url TEXT NOT NULL,
  pdf_url TEXT,
  pdf_path TEXT,
  page_image_urls TEXT NOT NULL DEFAULT '[]',
  pages INTEGER NOT NULL DEFAULT 0,
  region TEXT,
  variant TEXT,
  is_food INTEGER NOT NULL DEFAULT 1,
  extra TEXT NOT NULL DEFAULT '{}',
  fetched_at TEXT,
  status TEXT NOT NULL DEFAULT 'discovered'   -- discovered | fetched | extracted | failed
);
CREATE TABLE IF NOT EXISTS pages (
  leaflet_id TEXT NOT NULL,
  page_no INTEGER NOT NULL,
  image_path TEXT,
  method TEXT,                 -- structured | text_layer | vision
  raw_json TEXT,
  extracted_at TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (leaflet_id, page_no)
);
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  leaflet_id TEXT NOT NULL,
  store TEXT NOT NULL,
  page_no INTEGER NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  name_pl TEXT NOT NULL,
  brand TEXT,
  quantity REAL,
  unit TEXT,
  quantity_text TEXT,
  price_pln REAL NOT NULL,
  old_price_pln REAL,
  discount_pct REAL,
  unit_price_pln REAL,
  unit_price_unit TEXT,
  price_czk REAL,
  conditions TEXT NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'ostatni',
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  bbox TEXT,
  page_image_url TEXT,
  source TEXT NOT NULL,
  score REAL,
  verdict TEXT,
  reason TEXT,
  ean TEXT
);
CREATE INDEX IF NOT EXISTS offers_product ON offers(product_id, valid_from);
CREATE INDEX IF NOT EXISTS offers_valid ON offers(valid_from, valid_to);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  brand TEXT,
  quantity REAL,
  unit TEXT,
  category TEXT,
  aliases TEXT NOT NULL DEFAULT '[]',
  ean TEXT
);
CREATE TABLE IF NOT EXISTS rates (
  day TEXT PRIMARY KEY,
  czk_per_pln REAL NOT NULL
);
"""


@contextmanager
def connect(path: Path = DB_PATH) -> Iterator[sqlite3.Connection]:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def upsert_leaflet(con: sqlite3.Connection, lf: Leaflet, status: str | None = None) -> bool:
    """Insert a leaflet; returns True if it was new. Existing rows keep their status."""
    row = con.execute("SELECT status FROM leaflets WHERE id=?", (lf.id,)).fetchone()
    if row:
        con.execute(
            "UPDATE leaflets SET title=?, valid_from=?, valid_to=?, pdf_url=COALESCE(?, pdf_url), "
            "page_image_urls=?, pages=?, extra=? WHERE id=?",
            (lf.title, lf.valid_from.isoformat(), lf.valid_to.isoformat(), lf.pdf_url,
             json.dumps(lf.page_image_urls), lf.pages, json.dumps(lf.extra), lf.id),
        )
        return False
    con.execute(
        "INSERT INTO leaflets (id, store, title, valid_from, valid_to, source_url, pdf_url, page_image_urls, "
        "pages, region, variant, is_food, extra, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (lf.id, lf.store, lf.title, lf.valid_from.isoformat(), lf.valid_to.isoformat(), lf.source_url,
         lf.pdf_url, json.dumps(lf.page_image_urls), lf.pages, lf.region, lf.variant, int(lf.is_food),
         json.dumps(lf.extra), status or "discovered"),
    )
    return True


def row_to_leaflet(row: sqlite3.Row) -> Leaflet:
    return Leaflet(
        id=row["id"], store=row["store"], title=row["title"],
        valid_from=date.fromisoformat(row["valid_from"]), valid_to=date.fromisoformat(row["valid_to"]),
        source_url=row["source_url"], pdf_url=row["pdf_url"], page_image_urls=json.loads(row["page_image_urls"]),
        pages=row["pages"], region=row["region"], variant=row["variant"], is_food=bool(row["is_food"]),
        extra=json.loads(row["extra"]),
    )


def leaflets_by_status(con: sqlite3.Connection, status: str) -> list[Leaflet]:
    return [row_to_leaflet(r) for r in con.execute("SELECT * FROM leaflets WHERE status=?", (status,))]


def set_status(con: sqlite3.Connection, leaflet_id: str, status: str, pdf_path: str | None = None) -> None:
    con.execute(
        "UPDATE leaflets SET status=?, pdf_path=COALESCE(?, pdf_path), fetched_at=COALESCE(fetched_at, datetime('now')) WHERE id=?",
        (status, pdf_path, leaflet_id),
    )


def save_page(con: sqlite3.Connection, leaflet_id: str, page_no: int, method: str, raw: object,
              image_path: str | None = None, needs_review: bool = False) -> None:
    con.execute(
        "INSERT OR REPLACE INTO pages (leaflet_id, page_no, image_path, method, raw_json, extracted_at, needs_review) "
        "VALUES (?,?,?,?,?,datetime('now'),?)",
        (leaflet_id, page_no, image_path, method, json.dumps(raw, ensure_ascii=False), int(needs_review)),
    )


def page_done(con: sqlite3.Connection, leaflet_id: str, page_no: int) -> bool:
    return con.execute("SELECT 1 FROM pages WHERE leaflet_id=? AND page_no=?", (leaflet_id, page_no)).fetchone() is not None


def replace_offers(con: sqlite3.Connection, leaflet_id: str, page_no: int, offers: list[Offer]) -> None:
    con.execute("DELETE FROM offers WHERE leaflet_id=? AND page_no=?", (leaflet_id, page_no))
    for o in offers:
        d = o.model_dump(mode="json")
        d["conditions"] = json.dumps(d["conditions"], ensure_ascii=False)
        d["bbox"] = json.dumps(d["bbox"]) if d["bbox"] else None
        cols = ",".join(d.keys())
        con.execute(f"INSERT INTO offers ({cols}) VALUES ({','.join('?' * len(d))})", list(d.values()))


def row_to_offer(row: sqlite3.Row) -> Offer:
    d = dict(row)
    d["conditions"] = json.loads(d["conditions"] or "{}")
    d["bbox"] = json.loads(d["bbox"]) if d["bbox"] else None
    return Offer(**d)


def all_offers(con: sqlite3.Connection, where: str = "1=1", params: tuple = ()) -> list[Offer]:
    return [row_to_offer(r) for r in con.execute(f"SELECT * FROM offers WHERE {where}", params)]
