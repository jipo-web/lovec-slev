"""CZK per PLN from the Czech National Bank daily fixing."""
from __future__ import annotations

import sqlite3
from datetime import date

from .http import get_json

CNB = "https://api.cnb.cz/cnbapi/exrates/daily?lang=EN"


def fetch_czk_per_pln() -> float:
    data = get_json(CNB)
    for r in data.get("rates", []):
        if r.get("currencyCode") == "PLN":
            return float(r["rate"]) / float(r.get("amount") or 1)
    raise RuntimeError("PLN not in CNB response")


def czk_per_pln(con: sqlite3.Connection, today: date | None = None) -> float:
    today = (today or date.today()).isoformat()
    row = con.execute("SELECT czk_per_pln FROM rates WHERE day=?", (today,)).fetchone()
    if row:
        return row[0]
    try:
        rate = fetch_czk_per_pln()
        con.execute("INSERT OR REPLACE INTO rates (day, czk_per_pln) VALUES (?,?)", (today, rate))
        return rate
    except Exception:
        last = con.execute("SELECT czk_per_pln FROM rates ORDER BY day DESC LIMIT 1").fetchone()
        return last[0] if last else 5.85
