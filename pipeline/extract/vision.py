"""Vision-LLM extraction of one leaflet page image → list[RawOffer].

Uses any OpenAI-compatible chat endpoint (OpenRouter by default) with JSON
output. Costs ~0.02–0.08 CZK per page with Gemini Flash class models.
"""
from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path

import httpx
from PIL import Image

from ..config import VISION_API_KEY, VISION_BASE_URL, VISION_MAX_WIDTH, VISION_MODEL
from ..models import CATEGORIES, RawOffer

PROMPT = """Jesteś asystentem do odczytu gazetek promocyjnych polskich sklepów.
Na obrazie jest jedna strona gazetki. Wypisz WSZYSTKIE produkty z ceną promocyjną.
Zwróć wyłącznie JSON: {"offers": [ ... ]} gdzie każdy element ma pola:
- name: nazwa produktu po polsku, bez marki jeśli jest w polu brand
- brand: marka lub null
- quantity_text: gramatura/objętość/ilość tak jak wydrukowano ("500 g", "1 l", "3 x 200 g", "za kg") lub null
- price_text: cena w złotych, jaką klient płaci za 1 sztukę (lub za kg) w tej promocji, jak wydrukowano ("4,99", "14,99/kg"). NIGDY nie wpisuj tu procentu ani ceny "drugiego" produktu. Dla mechanik typu "drugi tańszy produkt X% taniej", "drugi za Y zł", "1+1 gratis", "2+1", "przy zakupie 2" wpisz do price_text cenę regularną 1 sztuki wydrukowaną przy produkcie, a mechanikę do conditions_text. Jeśli przy produkcie nie ma żadnej ceny w złotych, wpisz null.
- old_price_text: cena przed obniżką (przekreślona / "cena poza promocją") lub null
- discount_text: np. "-30%" lub null
- unit_price_text: cena za jednostkę jak wydrukowano (np. "9,98 zł/kg") lub null
- conditions_text: warunki promocji (aplikacja, karta, "przy zakupie 2", limit, "drugi -50%") lub null
- category: jedna z: {CATS}
- bbox: [x0, y0, x1, y1] – położenie kafelka produktu jako ułamki szerokości/wysokości strony (0–1)
Promocje na całą grupę ("wszystkie kawy", "wszystkie kosmetyki do włosów") wypisz jako jeden element z name = nazwa grupy i price_text = null, chyba że jest wydrukowana cena.
Pomiń reklamy bez ceny i teksty ogólne. Nie wymyślaj cen – jeśli cena jest nieczytelna, pomiń produkt.
""".replace("{CATS}", ", ".join(CATEGORIES))


def _encode_image(path: Path) -> str:
    im = Image.open(path).convert("RGB")
    if im.width > VISION_MAX_WIDTH:
        im = im.resize((VISION_MAX_WIDTH, int(im.height * VISION_MAX_WIDTH / im.width)))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def extract_image(path: Path, *, model: str = VISION_MODEL) -> tuple[list[RawOffer], dict]:
    """Returns (offers, raw response json). Raises on HTTP/parse errors."""
    if not VISION_API_KEY:
        raise RuntimeError("VISION_API_KEY / OPENROUTER_API_KEY is not set")
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{_encode_image(path)}"}},
                ],
            }
        ],
    }
    headers = {"Authorization": f"Bearer {VISION_API_KEY}", "HTTP-Referer": "https://github.com/jipo-web/lovec-slev",
               "X-Title": "lovec-slev"}
    for attempt in range(4):  # free tiers answer 429 on per-minute limits – wait and retry
        r = httpx.post(f"{VISION_BASE_URL}/chat/completions", headers=headers, json=body, timeout=120)
        if r.status_code == 429 and attempt < 3:
            wait = float(r.headers.get("retry-after") or 20 * (attempt + 1))
            time.sleep(min(wait, 90))
            continue
        break
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    content = content.strip().removeprefix("```json").removesuffix("```").strip()
    parsed = json.loads(content)
    offers = []
    for o in parsed.get("offers", []):
        try:
            if not o.get("name"):
                continue
            o["price_text"] = o.get("price_text") or ""  # "" = group promo without a printed price
            offers.append(RawOffer(**{k: o.get(k) for k in RawOffer.model_fields if k in o}))
        except Exception:
            continue
    return offers, data


def render_pdf_page(pdf_path: Path, page_no: int, out: Path, dpi: int = 150) -> Path:
    import pymupdf

    out.parent.mkdir(parents=True, exist_ok=True)
    if not out.exists():
        doc = pymupdf.open(pdf_path)
        doc[page_no - 1].get_pixmap(dpi=dpi).save(out)
    return out
