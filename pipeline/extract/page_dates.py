"""Date banners on a flyer page ("CZWARTEK – SOBOTA 12.11-14.11") and the
area each one covers. A separate, short model call: the answer is a few lines,
so it costs a fraction of the full offer extraction (≈ 0.02 CZK per page with
a Flash-class model) and can be run over pages that were extracted earlier.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

from ..config import VISION_API_KEY, VISION_BASE_URL, VISION_MODEL
from .vision import _encode_image, box_2d_to_bbox

PROMPT = """To jest strona polskiej gazetki promocyjnej.
Znajdź WSZYSTKIE napisy określające, w jakie dni obowiązują oferty, np.
"CZWARTEK – SOBOTA 12.11-14.11", "PIĄTEK – SOBOTA 13.11-14.11", "TYLKO W PONIEDZIAŁEK 16.11",
"OD PONIEDZIAŁKU 16.11", "Oferta ważna od 16.11 do 21.11".
Dla każdego takiego napisu zwróć:
- valid_text: tekst dokładnie tak, jak jest wydrukowany (z dniami tygodnia i datami)
- box_2d: [ymin, xmin, ymax, xmax] w skali 0–1000 – prostokąt OBSZARU STRONY, którego produkty ten napis dotyczy
  (zwykle sekcja pod napisem aż do następnego takiego napisu lub do końca strony; jeśli napis dotyczy całej strony, cała strona)
Nie zwracaj cen, limitów ani dat ważności kuponów/aplikacji niezwiązanych z dniami oferty.
Jeśli na stronie nie ma żadnego takiego napisu, zwróć pustą listę.
Odpowiedz wyłącznie JSON: {"dates": [{"valid_text": "...", "box_2d": [0, 0, 1000, 1000]}]}"""


def extract_dates(path: Path, *, model: str = VISION_MODEL) -> list[dict]:
    """[{"valid_text": str, "bbox": [x0, y0, x1, y1] | None}] for one page image."""
    if not VISION_API_KEY:
        raise RuntimeError("VISION_API_KEY / OPENROUTER_API_KEY is not set")
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{_encode_image(path)}"}},
        ]}],
    }
    headers = {"Authorization": f"Bearer {VISION_API_KEY}", "HTTP-Referer": "https://github.com/jipo-web/lovec-slev",
               "X-Title": "lovec-slev"}
    for attempt in range(4):
        r = httpx.post(f"{VISION_BASE_URL}/chat/completions", headers=headers, json=body, timeout=120)
        if r.status_code == 429 and attempt < 3:
            time.sleep(min(float(r.headers.get("retry-after") or 20 * (attempt + 1)), 90))
            continue
        break
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    return parse_answer(content)


def parse_answer(content: str) -> list[dict]:
    content = content.strip().removeprefix("```json").removesuffix("```").strip()
    items = json.loads(content).get("dates") or []
    out = []
    for it in items:
        if not isinstance(it, dict) or not isinstance(it.get("valid_text"), str) or not it["valid_text"].strip():
            continue
        out.append({"valid_text": it["valid_text"].strip(), "bbox": box_2d_to_bbox(it.get("box_2d"))})
    return out
