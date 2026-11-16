"""Leaflet discovery modules. Each exposes `list_leaflets() -> list[Leaflet]`."""
from __future__ import annotations

from collections.abc import Callable

from ..models import Leaflet
from . import biedronka, dino, lidl, kaufland

SOURCES: dict[str, Callable[[], list[Leaflet]]] = {
    "lidl": lidl.list_leaflets,
    "kaufland": kaufland.list_leaflets,
    "biedronka": biedronka.list_leaflets,
    "dino": dino.list_leaflets,
}

__all__ = ["SOURCES"]
