"""Assign a canonical product id to offers so history and cross-store
comparison work. Key = normalised name + brand + quantity; fuzzy fallback
against existing products (rapidfuzz). EAN wins when present."""
from __future__ import annotations

import hashlib
import json
import sqlite3

from rapidfuzz import fuzz, process

from .models import Offer
from .normalize import normalize_name_for_matching


def _key(o: Offer) -> str:
    q = f"{o.quantity:g}{o.unit}" if o.quantity and o.unit else ""
    return f"{normalize_name_for_matching(o.name)}|{(o.brand or '').lower()}|{q}"


def _pid(key: str) -> str:
    return "p_" + hashlib.sha1(key.encode()).hexdigest()[:12]


def assign_product_ids(con: sqlite3.Connection, offers: list[Offer], threshold: int = 92) -> None:
    rows = con.execute("SELECT id, canonical_name, brand, quantity, unit, aliases, ean FROM products").fetchall()
    by_ean = {r["ean"]: r["id"] for r in rows if r["ean"]}
    alias_index: dict[str, str] = {}
    for r in rows:
        for a in json.loads(r["aliases"]):
            alias_index[a] = r["id"]
    choices = list(alias_index)

    for o in offers:
        if o.ean and o.ean in by_ean:
            o.product_id = by_ean[o.ean]
            continue
        key = _key(o)
        if key in alias_index:
            o.product_id = alias_index[key]
            continue
        match = None
        if choices:
            hit = process.extractOne(key, choices, scorer=fuzz.token_set_ratio, score_cutoff=threshold)
            if hit:
                cand = hit[0]
                # quantity must agree when both known
                cq = cand.rsplit("|", 1)[-1]
                oq = key.rsplit("|", 1)[-1]
                if not cq or not oq or cq == oq:
                    match = alias_index[cand]
        if match:
            o.product_id = match
            alias_index[key] = match
            choices.append(key)
            con.execute("UPDATE products SET aliases=? WHERE id=?",
                        (json.dumps(sorted({*json.loads(con.execute('SELECT aliases FROM products WHERE id=?', (match,)).fetchone()[0]), key})), match))
            continue
        pid = _pid(key)
        o.product_id = pid
        con.execute(
            "INSERT OR IGNORE INTO products (id, canonical_name, brand, quantity, unit, category, aliases, ean) VALUES (?,?,?,?,?,?,?,?)",
            (pid, o.name, o.brand, o.quantity, o.unit, o.category, json.dumps([key]), o.ean),
        )
        alias_index[key] = pid
        choices.append(key)
        if o.ean:
            by_ean[o.ean] = pid
