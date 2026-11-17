"""Shared data contracts for the Lovec slev pipeline.

Every module (sources, extract, normalize, score, build) speaks these types.
Keep this file small and stable – the frontend JSON is derived from it.
"""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


StoreId = Literal["biedronka", "dino", "lidl", "kaufland"]

# Fixed category codebook. The vision model and the Dino/Lidl mappers must
# return one of these; anything else is mapped to "ostatni".
CATEGORIES: dict[str, str] = {
    "ovoce_zelenina": "Ovoce a zelenina",
    "maso_ryby": "Maso a ryby",
    "uzeniny": "Uzeniny",
    "mlecne": "Mléčné výrobky a vejce",
    "pecivo": "Pečivo",
    "trvanlive": "Trvanlivé potraviny",
    "mrazene": "Mražené",
    "sladkosti": "Sladkosti a snacky",
    "kava_caj": "Káva a čaj",
    "napoje": "Nápoje",
    "alkohol": "Alkohol",
    "drogerie": "Drogerie a kosmetika",
    "domacnost": "Domácnost",
    "deti": "Děti",
    "zvirata": "Zvířata",
    "ostatni": "Ostatní",
}


class PageSource(str, Enum):
    """How a page's offers were obtained."""

    structured = "structured"  # store API already lists products (Dino hotspots)
    text_layer = "text_layer"  # PDF text layer + rule-based pairing (Lidl/Kaufland)
    vision = "vision"  # vision LLM on a page image (Biedronka, fallback)


class Leaflet(BaseModel):
    """One leaflet publication as discovered on the store's site."""

    id: str = Field(description="stable id: '<store>:<source identifier>'")
    store: StoreId
    title: str
    valid_from: date
    valid_to: date
    source_url: str = Field(description="human page on the store's website")
    pdf_url: Optional[str] = None
    page_image_urls: list[str] = Field(default_factory=list, description="one URL per page, in order")
    pages: int = 0
    region: Optional[str] = None
    variant: Optional[str] = None  # e.g. Biedronka 'z ladą tradycyjną'
    is_food: bool = True  # non-food catalogues are shown but not extracted
    extra: dict = Field(default_factory=dict)  # raw source metadata (structured products etc.)


class Condition(BaseModel):
    app_only: bool = False  # Lidl Plus, Kaufland Card, Moja Biedronka
    multibuy: bool = False  # 2+1, "przy zakupie 2", "drugi -50%"
    min_qty: Optional[int] = None
    max_qty: Optional[int] = None  # limit per customer / card / day
    text: Optional[str] = None  # original Polish wording, short


class RawOffer(BaseModel):
    """What extraction returns before normalisation. Strings stay as seen."""

    name: str  # Polish, as printed
    name_cs: Optional[str] = None  # Czech translation from the model, if it gave one
    brand: Optional[str] = None
    quantity_text: Optional[str] = None  # "500 g", "1 l", "3 x 200 g", "za kg"
    price_text: str  # "4,99", "2 za 9,98", "14,99 / kg"
    old_price_text: Optional[str] = None
    discount_text: Optional[str] = None  # "-30%", "taniej o 2 zł"
    unit_price_text: Optional[str] = None  # "9,98 zł / kg" as printed
    conditions_text: Optional[str] = None
    category: str = "ostatni"
    bbox: Optional[list[float]] = None  # [x0, y0, x1, y1]; normalize_bbox() turns any scale into 0..1
    ean: Optional[str] = None


class Offer(BaseModel):
    """Normalised offer – one row of the offers table and one card on the web."""

    id: str
    leaflet_id: str
    store: StoreId
    page_no: int  # 1-based
    product_id: Optional[str] = None
    name: str  # Czech (falls back to Polish until translated)
    name_pl: str
    brand: Optional[str] = None
    quantity: Optional[float] = None  # 0.5
    unit: Optional[str] = None  # kg | l | ks
    quantity_text: Optional[str] = None
    price_pln: float
    old_price_pln: Optional[float] = None
    discount_pct: Optional[float] = None
    unit_price_pln: Optional[float] = None  # per kg / l / ks
    unit_price_unit: Optional[str] = None
    price_czk: Optional[float] = None
    conditions: Condition = Field(default_factory=Condition)
    category: str = "ostatni"
    valid_from: date
    valid_to: date
    bbox: Optional[list[float]] = None
    page_image_url: Optional[str] = None
    source: PageSource = PageSource.vision
    score: Optional[float] = None
    verdict: Optional[Literal["trhak", "dobra_koupe", "nic_moc", "past"]] = None
    reason: Optional[str] = None
    ean: Optional[str] = None
