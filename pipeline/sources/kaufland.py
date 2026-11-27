"""Kaufland Polska – Schwarz leaflet platform, with gazetkipromocyjne.net as fallback.

kaufland.pl itself blocks datacenter IPs (403 "Dostęp zablokowany"), but the
ESI overview and the flyer API answer without restriction. Region 0 is the
national edition; regional leaflets (e.g. Śląskie) appear once a region_id
for the nearest store is configured via KAUFLAND_REGION_CODE.

Since 26 Nov 2026 the national overview is empty, so leaflets also come from
gazetkipromocyjne.net. A mirrored leaflet is skipped when Schwarz already has
the same kind of leaflet (weekly / Mocny Start / …) for the same dates.
"""
from __future__ import annotations

import re
import sys

from ..config import KAUFLAND_REGION_CODE
from ..models import Leaflet
from . import gazetkipromocyjne, schwarz

# Mirror leaflets the vision model reads. Seasonal catalogues (decorations,
# drugstore, toys, bar/alcohol, "Złap Okazje" non-food) are listed but not read.
FOOD_TITLES = ("gazetka tygodnia", "mocny start", "ryby z naszej lady")


def _kind(title: str) -> str:
    t = title.lower()
    if "mocny start" in t:
        return "mocny start"
    if "gazetka tygodnia" in t or re.match(r"kaufland \d", t):
        return "weekly"
    return re.sub(r"[^a-ząćęłńóśźż]+", " ", t).strip()


def merge_sources(official: list[Leaflet], mirror: list[Leaflet]) -> list[Leaflet]:
    have = {(lf.valid_from, lf.valid_to, _kind(lf.title)) for lf in official}
    return official + [lf for lf in mirror if (lf.valid_from, lf.valid_to, _kind(lf.title)) not in have]


def list_leaflets() -> list[Leaflet]:
    # Kaufland's overview rejects the store_id parameter → pass None.
    official: list[Leaflet] = []
    try:
        official = schwarz.list_leaflets("kaufland", "kaufland/pl-PL", KAUFLAND_REGION_CODE, store_id=None)
    except Exception as e:  # pragma: no cover - network
        print(f"[kaufland] schwarz overview failed: {e}", file=sys.stderr)
    mirror: list[Leaflet] = []
    try:
        mirror = gazetkipromocyjne.list_leaflets("kaufland", "kaufland", FOOD_TITLES)
    except Exception as e:  # pragma: no cover - network
        print(f"[kaufland] gazetkipromocyjne failed: {e}", file=sys.stderr)
    if not official and not mirror:
        raise RuntimeError("no Kaufland leaflets from either source")
    return merge_sources(official, mirror)
