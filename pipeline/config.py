"""Runtime configuration – everything tunable lives here or in env vars."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("LOVEC_DATA_DIR", ROOT / "data"))
CACHE_DIR = DATA_DIR / "cache"  # downloaded PDFs / page images (not committed)
OUT_DIR = Path(os.environ.get("LOVEC_OUT_DIR", ROOT / "public" / "data"))  # JSON for the web
DB_PATH = Path(os.environ.get("LOVEC_DB", DATA_DIR / "lovec.db"))

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36 lovec-slev/0.1 (+personal, non-commercial)"
)
REQUEST_DELAY_S = 1.0
TIMEOUT_S = 30

# Default region: Zebrzydowice / Jastrzębie-Zdrój (Śląskie). Lidl/Kaufland
# leaflets carry region codes; "0" = national edition, used until a store id
# for the nearest shop is configured.
LIDL_REGION_CODE = os.environ.get("LIDL_REGION_CODE", "0")
KAUFLAND_REGION_CODE = os.environ.get("KAUFLAND_REGION_CODE", "0")

# Schwarz group leaflet API (Lidl + Kaufland share it)
SCHWARZ_API = "https://endpoints.leaflets.schwarz/v4"

# Vision model via OpenRouter (OpenAI-compatible). Any OpenAI-compatible
# endpoint works: set VISION_BASE_URL / VISION_API_KEY / VISION_MODEL.
VISION_BASE_URL = os.environ.get("VISION_BASE_URL", "https://openrouter.ai/api/v1")
VISION_API_KEY = os.environ.get("VISION_API_KEY") or os.environ.get("OPENROUTER_API_KEY", "")
VISION_MODEL = os.environ.get("VISION_MODEL", "google/gemini-2.5-flash")
VISION_MAX_WIDTH = 1200  # px; page images are downscaled before upload
VISION_MAX_PAGES_PER_RUN = int(os.environ.get("VISION_MAX_PAGES_PER_RUN", "300"))

# Scoring
HISTORY_WEEKS = 8
WEIGHTS = {"history": 0.5, "cross_store": 0.3, "unit_price": 0.2}

# Which leaflets get product extraction. Non-food catalogues are listed
# on the web but skipped to save model calls.
NON_FOOD_TITLE_HINTS = (
    "zabaw", "home", "moda", "ogr", "dom ", "katalog", "wino", "karta win", "alkohol", "toast",
    "piękne strony", "elektro", "parkside", "livarno", "silvercrest", "crivit",
)
