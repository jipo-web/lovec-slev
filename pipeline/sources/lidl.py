"""Lidl Polska – via the Schwarz leaflet platform (see schwarz.py)."""
from __future__ import annotations

from ..config import LIDL_REGION_CODE
from ..models import Leaflet
from . import schwarz


def list_leaflets() -> list[Leaflet]:
    return schwarz.list_leaflets("lidl", "lidl/pl-PL", LIDL_REGION_CODE, store_id="0")
