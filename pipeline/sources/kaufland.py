"""Kaufland Polska – via the Schwarz leaflet platform (see schwarz.py).

kaufland.pl itself blocks datacenter IPs (403 "Dostęp zablokowany"), but the
ESI overview and the flyer API answer without restriction. Region 0 is the
national edition; regional leaflets (e.g. Śląskie) appear once a region_id
for the nearest store is configured via KAUFLAND_REGION_CODE.
"""
from __future__ import annotations

from ..config import KAUFLAND_REGION_CODE
from ..models import Leaflet
from . import schwarz


def list_leaflets() -> list[Leaflet]:
    # Kaufland's overview rejects the store_id parameter → pass None.
    return schwarz.list_leaflets("kaufland", "kaufland/pl-PL", KAUFLAND_REGION_CODE, store_id=None)
