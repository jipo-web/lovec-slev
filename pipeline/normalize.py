"""Normalisation of raw extracted offers (Polish leaflets) into `Offer` rows.

Pure functions only: no network, no DB. Everything here is heuristic text
parsing, so each helper returns None / "ostatni" instead of raising.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date
from typing import Optional

from .models import CATEGORIES, Condition, Offer, PageSource, RawOffer

PRICE_MIN, PRICE_MAX = 0.05, 2000.0

_NUM = r"\d+(?:[.,]\d+)?"
_UNIT = r"(?:litr\w*|kg|dag|ml|cl|szt\w*|opak\w*|ks|g|l)"
# number must not be glued to a preceding word char ("A10x220l" is a model code, not a quantity)
_QTY_RE = re.compile(rf"(?<![\w.,])({_NUM})\s*({_UNIT})(?!\w)")
_MULTI_RE = re.compile(rf"(?<![\w.,])(\d+)\s*[x×]\s*({_NUM})\s*({_UNIT})(?!\w)")
_BARE_UNIT_RE = re.compile(r"^(?:cena\s+)?(?:za\s+)?(kg|l|szt\w*|ks|opak\w*)\.?$")

# unit -> (factor to base unit, base unit)
_UNIT_MAP = {"kg": (1.0, "kg"), "g": (0.001, "kg"), "dag": (0.01, "kg"),
             "l": (1.0, "l"), "ml": (0.001, "l"), "cl": (0.01, "l"), "ks": (1.0, "ks")}


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def _fold(text: str) -> str:
    """Lowercase and strip Polish/Czech diacritics."""
    t = text.lower().replace("ł", "l").replace("\xa0", " ")
    t = unicodedata.normalize("NFKD", t)
    return "".join(c for c in t if not unicodedata.combining(c))


def _unit_info(u: str) -> tuple[float, str]:
    u = u.lower().rstrip(".")
    if u.startswith("litr"):
        u = "l"
    elif u.startswith(("szt", "opak")):
        u = "ks"
    return _UNIT_MAP[u]


# ---------------------------------------------------------------- price

def parse_price(text: str) -> float | None:
    """Parse a Polish price string to PLN, or None on garbage / out of range.

    Heuristic: a bare integer of 3-4 digits (no separator) that would be > 200
    as-is and does not end in "00" is read as zloty+grosze printed as
    superscript ("1299" -> 12.99, "499" -> 4.99). Values <= 200 stay as-is.
    "N za X" gives the per-piece price X/N. Everything after "/" is ignored.
    """
    if not text:
        return None
    s = text.lower().replace("\xa0", " ").strip()
    m = re.search(rf"(?<![\d,.])(\d+)\s*(?:szt\w*\.?\s*)?za\s*({_NUM})", s)
    if m and int(m.group(1)) >= 1:
        return _check(round(_num(m.group(2)) / int(m.group(1)), 2))
    s = s.split("/")[0]
    s = re.sub(r"^(\s*\d{1,2}) (?=\d{3}(?:[.,]\d{1,2})?\s*(?:zl|zł|pln)?\s*$)", r"\1", s)  # "1 299,00"
    m = re.search(rf"(?<![\d.,])({_NUM})(?![\d])", s)
    if not m:
        return None
    tok = m.group(1)
    if re.search(r"[.,]", tok):
        if len(re.split(r"[.,]", tok)[1]) > 2:
            return None
        return _check(_num(tok))
    val = float(tok)
    if len(tok) in (3, 4) and val > 200 and not tok.endswith("00"):
        val = val / 100
    return _check(round(val, 2))


def _check(v: float) -> float | None:
    return v if PRICE_MIN <= v <= PRICE_MAX else None


# ------------------------------------------------------------- quantity

def _find_qty(s: str) -> tuple[float, str, str] | None:
    """Find a quantity in free text -> (qty in base unit, unit, matched text)."""
    m = _MULTI_RE.search(s)
    if m:
        f, base = _unit_info(m.group(3))
        return round(int(m.group(1)) * _num(m.group(2)) * f, 4), base, m.group(0)
    ms = list(_QTY_RE.finditer(s))
    if not ms:
        return None
    f, base = _unit_info(ms[0].group(2))
    total, end = _num(ms[0].group(1)) * f, ms[0].end()
    for nxt in ms[1:]:  # "250 g + 50 g gratis" -> sum
        f2, b2 = _unit_info(nxt.group(2))
        if b2 == base and "+" in s[end:nxt.start()]:
            total += _num(nxt.group(1)) * f2
            end = nxt.end()
    return round(total, 4), base, s[ms[0].start():end]


def parse_quantity(text: str | None, name: str | None = None
                   ) -> tuple[float | None, str | None, str | None]:
    """Parse a quantity string -> (quantity, unit kg|l|ks, cleaned_text).

    If `text` is empty the optional product `name` is searched instead.
    """
    src = re.sub(r"\s+", " ", text).strip() if text else ""
    if src:
        low = src.lower()
        found = _find_qty(low)
        if found:
            return found[0], found[1], src
        b = _BARE_UNIT_RE.match(low)
        if b:
            return 1.0, _unit_info(b.group(1))[1], src
        return None, None, src
    if name:
        found = _find_qty(name.lower())
        if found:
            return found[0], found[1], found[2]
    return None, None, None


def effective_unit_price(price: float, qty: float | None, unit: str | None
                         ) -> tuple[float | None, str | None]:
    """Price per kg / l / piece, rounded to 2 decimals."""
    if not qty or qty <= 0 or unit not in ("kg", "l", "ks"):
        return None, None
    return round(price / qty, 2), unit


def parse_unit_price_text(text: str | None) -> tuple[float | None, str | None]:
    """Parse printed unit prices ("9,98 zł / kg", "100 g = 1,20 zł") to per kg/l/ks."""
    if not text:
        return None, None
    s = text.lower().replace("\xa0", " ")
    m = re.search(rf"(?<![\w.,])({_NUM})?\s*({_UNIT})\s*=\s*({_NUM})", s)
    if m:
        f, base = _unit_info(m.group(2))
        q = (_num(m.group(1)) if m.group(1) else 1.0) * f
        return round(_num(m.group(3)) / q, 2), base
    m = re.search(rf"({_NUM})\s*(?:zl|zł|pln)?\s*/\s*({_NUM})?\s*({_UNIT})(?!\w)", s)
    if m:
        f, base = _unit_info(m.group(3))
        q = (_num(m.group(2)) if m.group(2) else 1.0) * f
        return round(_num(m.group(1)) / q, 2), base
    return None, None


# ------------------------------------------------------------- discount

def parse_discount(text: str | None) -> float | None:
    """"-30%", "30% taniej", "taniej o 30%" -> 30.0 (percent only)."""
    if not text:
        return None
    m = re.search(rf"({_NUM})\s*%", text)
    if not m:
        return None
    v = _num(m.group(1))
    return v if 0 < v <= 100 else None


# ----------------------------------------------------------- conditions

_APP_KW = ("lidl plus", "z aplikacja", "z karta", "moja biedronka", "kaufland card",
           "k-card", "kupon", "w aplikacji")


def parse_conditions(text: str | None, price_text: str, discount_text: str | None) -> Condition:
    """Detect app-only, multibuy, min/max quantity from all printed texts."""
    orig = (text or "").strip()
    s = _fold(" ".join(x for x in (text, price_text, discount_text) if x))
    app = any(k in s for k in _APP_KW)
    multibuy, min_qty = False, None

    def hit(q: int | None) -> None:
        nonlocal multibuy, min_qty
        multibuy = True
        if min_qty is None and q and 2 <= q <= 99:
            min_qty = q

    m = re.search(r"(?<![\d,.])(\d)\s*\+\s*(\d)(?![\d,.])", s)
    if m:
        hit(int(m.group(1)) + int(m.group(2)))
    if re.search(r"\bdrugi\w*\b[^.]*?(?:\d+\s*%|gratis|taniej)", s):
        hit(2)
    m = re.search(r"przy zakupie\s+(\d+)", s)
    if m:
        hit(int(m.group(1)))
    m = re.search(r"(?<![\d,.])(\d+)\s*(?:szt\w*\.?\s*)?za\s+\d", s)
    if m:
        hit(int(m.group(1)))
    m = re.search(r"(\d+)\s*szt\w*\.?\s*w cenie\s*(\d+)", s)
    if m:
        hit(int(m.group(1)))
    if "w zestawie" in s:
        hit(None)

    max_qty = None
    m = (re.search(r"\b(?:limit(?:\s+dzienny)?|maks(?:ymalnie)?\.?|max(?:ymalnie)?\.?)\s*[:=]?\s*(\d+)", s)
         or re.search(r"\bdo\s+(\d+)\s*(?:szt|opak)\w*\.?\s+na\s+(?:klienta|osobe|paragon)", s))
    if m:
        max_qty = int(m.group(1))
    return Condition(app_only=app, multibuy=multibuy, min_qty=min_qty,
                     max_qty=max_qty, text=orig[:120] or None)


# ------------------------------------------------------------- category

# Priority order matters. "=kw" = exact token, "a b" = phrase substring, else token prefix.
_CAT_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("mrazene", ("mrozon", "mrozen", "lody", "mrazen", "pizza mroz")),
    ("zvirata", ("karma", "dla psa", "dla kota", "whiskas", "pedigree", "zwirek", "zvirat", "zwierz")),
    ("deti", ("pieluch", "mleko modyf", "bebilon", "nutrilon", "kaszka", "dla dzieci", "=deti", "=dite", "gerber")),
    ("drogerie", ("proszek", "szampon", "papier toalet", "chusteczk", "pasta do zeb", "mydlo", "dezodorant",
                  "zel pod prysznic", "plyn do", "tampon", "podpask", "golark", "odzywk", "kosmetyk", "higien",
                  "chemia", "drogeri", "pasta do", "plyn")),
    ("domacnost", ("serwet", "worki", "folia", "recznik papier", "gabk", "swiec", "zarowk", "bateri",
                   "domacnost", "dom i", "garnek", "patelni", "ziemia")),
    ("alkohol", ("piwo", "piwa", "=wino", "=wina", "wodka", "whisky", "=rum", "likier", "alkohol",
                 "prosecco", "szampan", "cydr", "wermut", "=gin", "koniak", "winiak")),
    ("kava_caj", ("=kawa", "=kawy", "=kawe", "herbat", "kapsulki", "kava", "=caj", "espresso", "nescafe")),
    ("uzeniny", ("kielbas", "szynk", "parowk", "salami", "wedlin", "kabanos", "pasztet", "mortadel",
                 "uzenin", "poledwica sopocka")),
    ("maso_ryby", ("kurczak", "kurcz", "wieprzow", "wolowin", "=ryba", "=ryby", "=rybe", "rybn", "losos",
                   "indyk", "schab", "karkowk", "mieso", "mielone", "poledwi", "filet", "boczek", "krewetk",
                   "dorsz", "makrel", "karkow", "kaczk", "udko", "skrzydelk", "=maso", "halibut",
                   "sledz", "pstrag", "wolow", "cielecin", "baranin")),
    ("pecivo", ("chleb", "bulk", "bagiet", "drozdz", "rogal", "precel", "paczek", "tost", "pieczyw",
                "chalk", "peciv", "bulecz")),
    ("sladkosti", ("czekolad", "chips", "ciastk", "baton", "cukierk", "wafel", "lizak", "zelki", "slodycz",
                   "sladkost", "snack", "krakers", "paluszk", "popcorn", "orzeszk", "praline", "ciasto",
                   "herbatnik", "lentilk", "draze")),
    ("napoje", ("=woda", "=wody", "=wode", "=sok", "=soki", "=soku", "napoj", "nektar", "lemoniad", "cola",
                "pepsi", "fanta", "sprite", "izotonik", "oranzad", "energetyk", "napoje", "mineraln")),
    ("mlecne", ("mleko", "mleka", "jogurt", "maslo", "maslan", "=ser", "=sery", "=sera", "serek", "serk",
                "smietan", "twarog", "kefir", "margaryn", "mozzarell", "parmezan", "feta", "camembert",
                "gouda", "edam", "=jaja", "jajk", "jajec", "nabial", "mlecn", "mleczn", "deser", "budyn", "skyr")),
    ("ovoce_zelenina", ("pomidor", "jablk", "banan", "ziemniak", "ogork", "cebul", "marchew", "papryk",
                        "salat", "cytryn", "pomarancz", "winogron", "truskawk", "malin", "borowk", "arbuz",
                        "czosnek", "kapust", "brokul", "szpinak", "grzyb", "pieczark", "awokado", "avocado",
                        "gruszk", "sliwk", "owoc", "warzyw", "mandaryn", "kiwi", "ananas", "brzoskwin",
                        "=por", "ovoce", "zelenin", "rzodkiew", "buraki", "burak", "dynia", "cukini", "seler")),
    ("trvanlive", ("makaron", "=ryz", "=maka", "=maki", "olej", "oliw", "cukier", "=sol", "przypraw", "konserw",
                   "puszk", "=dzem", "=miod", "platki", "musli", "majonez", "ketchup", "musztard", "=sos",
                   "=sosy", "zup", "kasza", "kasze", "fasol", "kukurydz", "bakali", "tunczyk", "ocet",
                   "trvanliv", "spizarn", "groszek", "ciecierzyc", "proszek do pieczenia")),
]


def normalize_category(text: str | None, name: str | None = None) -> str:
    """Map any category string (PL/CZ/model guess) to a CATEGORIES key; fallback on `name`."""
    for src in (text, name):
        if not src:
            continue
        f = _fold(src).strip()
        if f in CATEGORIES:
            if f != "ostatni":
                return f
            continue
        for key, label in CATEGORIES.items():
            if f == _fold(label):
                return key
        tokens = re.findall(r"[a-z0-9]+", f)
        tokset, joined = set(tokens), " " + " ".join(tokens) + " "
        for key, kws in _CAT_KEYWORDS:
            for kw in kws:
                if kw.startswith("="):
                    if kw[1:] in tokset:
                        return key
                elif " " in kw.strip():
                    if _fold(kw) in joined:
                        return key
                elif any(t.startswith(_fold(kw.strip())) for t in tokens):
                    return key
    return "ostatni"


# ------------------------------------------------------------ matching

def normalize_name_for_matching(name: str) -> str:
    """Lowercase, strip diacritics/punctuation and quantity tokens, collapse spaces."""
    s = _fold(name)
    s = _MULTI_RE.sub(" ", s)
    s = _QTY_RE.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# ------------------------------------------------------------ normalize

_MB_PCT = re.compile(r"drug[iay]\w*[^%\d]{0,40}?(\d{1,3})\s*%\s*taniej|(\d{1,3})\s*%\s*taniej[^.]{0,30}drug", re.I)
_MB_ZL = re.compile(r"drug[iay]\w*[^\d]{0,40}?za\s*(\d+[,.]?\d*)\s*z[łl]", re.I)
_MB_PLUS = re.compile(r"\b(\d)\s*\+\s*(\d)\b(?:\s*gratis)?", re.I)
_MB_GRATIS = re.compile(r"(?:drug[iay]\w*|ta[ńn]szy produkt)\s+(?:produkt\s+)?gratis|tańszy produkt gratis", re.I)


def multibuy_effective_price(price: float, text: str | None) -> tuple[float, str | None]:
    """Average per-piece price when the printed price is the regular one and the
    promotion is a 'second item' mechanic. Returns (price, mechanic label)."""
    if not text:
        return price, None
    m = _MB_PCT.search(text)
    if m:
        pct = int(m.group(1) or m.group(2))
        if 0 < pct <= 100:
            return round(price * (1 - pct / 200), 2), f"2. kus -{pct} %"
    m = _MB_ZL.search(text)
    if m:
        second = _num(m.group(1))
        if second < price:
            return round((price + second) / 2, 2), f"2. kus za {second:g} zł"
    if _MB_GRATIS.search(text):
        return round(price / 2, 2), "1+1 zdarma"
    m = _MB_PLUS.search(text)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if a and b and "gratis" in text.lower():
            return round(price * a / (a + b), 2), f"{a}+{b} zdarma"
    return price, None


def looks_like_misread_percent(price: float, text: str | None) -> bool:
    """Model put the discount percent into the price ("70" with '70% taniej')."""
    return bool(text) and price == int(price) and f"{int(price)}%" in text.replace(" %", "%")


def normalize(raw: RawOffer, *, leaflet_id: str, store: str, page_no: int,
              valid_from: date, valid_to: date, page_image_url: str | None,
              source: PageSource, rate_czk_per_pln: float | None, idx: int) -> Offer | None:
    """Build an `Offer` from a `RawOffer`; None if the price cannot be parsed."""
    price = parse_price(raw.price_text)
    name = re.sub(r"[\s.,;:\-–—]+$", "", re.sub(r"\s+", " ", raw.name or "").strip())
    if price is None or not name:
        return None
    cond_src = " ".join(t for t in (raw.conditions_text, raw.discount_text) if t)
    if looks_like_misread_percent(price, cond_src):
        return None
    old = parse_price(raw.old_price_text) if raw.old_price_text else None
    mechanic = None
    if not (old and old > price):  # printed price is the regular one → derive the effective price
        eff, mechanic = multibuy_effective_price(price, cond_src)
        if mechanic:
            old, price = price, eff

    qty, unit, qtext = parse_quantity(raw.quantity_text, name=name)
    if qty is None:  # "14,99/kg" printed in the price itself, or "Pomidor kg" (Dino)
        m = re.search(r"/\s*(kg|l|szt)", raw.price_text.lower()) or re.search(r"\b(kg|l)\b\s*$", name.lower())
        if m:
            qty, unit = 1.0, _unit_info(m.group(1))[1]

    disc = parse_discount(raw.discount_text)
    if disc is None and old and old > price:
        disc = round((1 - price / old) * 100, 1)

    up, up_unit = effective_unit_price(price, qty, unit)
    if up is None:
        up, up_unit = parse_unit_price_text(raw.unit_price_text)

    return Offer(
        id=f"{leaflet_id}:p{page_no}:{idx}", leaflet_id=leaflet_id, store=store,  # type: ignore[arg-type]
        page_no=page_no, name=name, name_pl=name, brand=raw.brand,
        quantity=qty, unit=unit, quantity_text=qtext,
        price_pln=price, old_price_pln=old if old and old > price else None,
        discount_pct=disc, unit_price_pln=up, unit_price_unit=up_unit,
        price_czk=round(price * rate_czk_per_pln, 2) if rate_czk_per_pln else None,
        conditions=_with_mechanic(parse_conditions(raw.conditions_text, raw.price_text, raw.discount_text), mechanic),
        category=normalize_category(raw.category, name),
        valid_from=valid_from, valid_to=valid_to, bbox=raw.bbox,
        page_image_url=page_image_url, source=source, ean=raw.ean,
    )


def _with_mechanic(c: Condition, mechanic: str | None) -> Condition:
    if mechanic:
        c.multibuy = True
        c.min_qty = c.min_qty or 2
        c.text = f"{mechanic}; {c.text}" if c.text else mechanic
    return c
