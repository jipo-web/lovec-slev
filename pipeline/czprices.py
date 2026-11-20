"""Czech reference prices from ojeb.cz – the cheapest current Czech promotion
for the same *kind* of goods (máslo, mléko, vepřová krkovice …).

ojeb.cz (by DeeplinkHQ) publishes a public read-only JSON API and MCP server
for agents: GET https://ojeb.cz/api/offers?q=<text>&limit=200. Every offer has
a `product_type` (Czech generic noun) and a unit price ("131,60 Kč/kg").

Polish names stay untranslated. A short list of generic Polish words maps an
offer to one Czech `product_type`; the comparison is per kg / l / piece, only
against Czech offers available to everybody (no card, coupon or multi-buy) and
of a similar pack size. One request per kind and day, cached in SQLite.
"""
from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from dataclasses import dataclass
from datetime import date

API = "https://ojeb.cz/api/offers"
SOURCE = "ojeb.cz"


def fold(text: str) -> str:
    t = (text or "").lower().replace("ł", "l")
    t = unicodedata.normalize("NFKD", t)
    return "".join(c for c in t if not unicodedata.combining(c))


@dataclass(frozen=True)
class Rule:
    cz_type: str          # ojeb.cz product_type
    unit: str             # kg | l | ks – must match both sides
    include: str          # regex on the folded Polish name
    exclude: str | None = None
    cz_exclude: str | None = None  # regex on the folded Czech offer name (other variety)


# Only uniform goods where the brand hardly matters (the same principle ojeb.cz
# uses for "jinde levněji"): fruit, vegetables, fresh meat and basic staples.
# Branded or processed goods (pizza, chocolate, beer, sausages, coffee …) differ
# too much – comparing them with the cheapest Czech offer would mislead.
# Patterns are anchored to the start of the name ("Pasztecik z pieczarkami" is
# not mushrooms). Order matters: the first matching rule wins.
_FRESH = r"^(swiez\w* |polsk\w* |krajow\w* |ekologiczn\w* |bio )?"
RULES: list[Rule] = [
    # dairy & eggs
    Rule("máslo", "kg", r"^maslo\b", r"orzech|klarow|roslin|czosnk|ziol|shea|kakaow|smakow", r"pomazank|bylink|cesnek|ghi|prepust"),
    Rule("mléko", "l", r"^mleko\b", r"skondens|w proszku|bebi|modyfik|kokos|owsian|roslin|zageszcz|czekolad|kakao|ryzow|sojow|migdal|bez laktozy",
         r"bez laktozy|kakao|cokolad|kondenz|ochucen|bio"),
    Rule("smetana ke šlehání", "l", r"^smietan\w*\b.*\b(30|36)\s*%", r"spray|fix"),
    Rule("zakysaná smetana", "kg", r"^smietan\w*\b.*\b(12|18)\s*%", r"spray|fix"),
    Rule("mozzarella", "kg", r"^ser mozzarella\b|^mozzarella\b", r"mini|kulki|wedzon|tart|wiork", r"light|mini|strouh|uzen|buffal"),
    Rule("sýr", "kg", r"^ser (gouda|edam|zolty (gouda|edam))", r"tart|grill|ziol|mierzwion|wedzon", r"uzen|strouh|light|paren|pivni"),
    Rule("vejce", "ks", r"^jaja\b"),
    # fresh meat
    Rule("mleté maso", "kg", r"^mieso mielone\b", r"wolow|indyk|drob"),
    Rule("vepřová krkovice", "kg", r"^karkowk", r"wedzon|pieczon|gotowan|marynow|plastr"),
    Rule("vepřová žebra", "kg", r"^zeberk\w* wieprz", r"wedzon|pieczon|marynow|bbq"),
    Rule("vepřové koleno", "kg", r"^golonk", r"wedzon|pieczon|gotowan|w piwie"),
    Rule("vepřový bok", "kg", r"^boczek wieprzowy\b", r"wedzon|pieczon|gotowan|marynow|plastr"),
    Rule("kuřecí prsa", "kg", _FRESH + r"(filet\w* z (piersi )?kurczak|piers z kurczak|filet z piersi)", r"panier|marynow|gotowan|wedzon|pieczon|stripsy",
         r"s kost|marinov|obalov|uzen|strips|nugget|gyros|rizky v|plnen"),
    Rule("kuřecí paličky", "kg", _FRESH + r"podudzi", r"panier|marynow|pieczon|wedzon"),
    Rule("kuřecí stehna", "kg", _FRESH + r"ud(o|ka) z kurczak", r"panier|marynow|pieczon|wedzon"),
    Rule("kuřecí křídla", "kg", _FRESH + r"skrzyd\w* z kurczak", r"panier|marynow|pieczon|wedzon|gruzin|bbq"),
    # fruit & vegetables
    Rule("banány", "kg", _FRESH + r"banan(y|ow)?\b", r"suszon|chips"),
    Rule("citrony", "kg", _FRESH + r"cytryn(y|a)\b", r"suszon|sok"),
    Rule("pomeranče", "kg", _FRESH + r"pomarancz(e|a)\b", r"suszon|sok"),
    Rule("mandarinky", "kg", _FRESH + r"mandaryn(ki|ka)\b", r"suszon|puszk"),
    Rule("jablka", "kg", _FRESH + r"jablk(a|o)\b", r"suszon|chips|sok|mus"),
    Rule("hrušky", "kg", _FRESH + r"gruszk(i|a)\b", r"suszon"),
    Rule("hrozny", "kg", _FRESH + r"winogron", r"suszon"),
    Rule("kiwi", "kg", _FRESH + r"kiwi\b", r"suszon"),
    Rule("borůvky", "kg", _FRESH + r"borowk", r"suszon|mrozon|dzem"),
    Rule("brambory", "kg", _FRESH + r"ziemniak", r"pure|placki|salatk|frytk"),
    Rule("cibule", "kg", _FRESH + r"cebul(a|e)\b", r"dymk|zielon|prazon|suszon|marynow|czerwon|szalot", r"cerven|salotk|jarni"),
    Rule("rajčata", "kg", _FRESH + r"pomidor(y|ki)?\b", r"suszon|krojon|puszk|koncentrat|przecier|passat|bez skork|cale|w soku|koktajl|daktyl|cherry|shaker|malin|kumato",
         r"cherry|koktejl|datlov|cherr|loupan|sterilov|minirajc|snack"),
    Rule("mrkev", "kg", _FRESH + r"marchew", r"tarta|z groszkiem|sok"),
    Rule("okurky", "kg", _FRESH + r"ogor(ek|ki)\b", r"kiszon|konserw|korniszon|marynow"),
    Rule("česnek", "kg", _FRESH + r"czosnek\b", r"granul|mielon|niedzwiedz|suszon|proszk"),
    Rule("žampiony", "kg", _FRESH + r"pieczark", r"marynow|konserw|puszk|zalew"),
    # basic staples
    Rule("cukr", "kg", r"^cukier\b", r"puder|wanil|trzcin|zelujac|kostk|brazow"),
    Rule("mouka", "kg", r"^maka (pszenna|tortowa|krupczatka)", r"pelnoziarn|razow|orkisz", r"celozrn|spald|zitn|zitna|bezlepk|pizza"),
    Rule("rýže", "kg", r"^ryz (bialy|dlugoziarnist)", r"brazow|parboil|basmati|jasmin|torebk|\dx\d|risotto",
         r"natural|parboil|jasmin|basmati|varn|sacc|arbori|kulat|divok"),
    Rule("těstoviny", "kg", r"^makaron (spaghetti|fusilli|penne|swiderki|kokardki|nitki|rurki|muszelki)\b", r"protein|jaj|pelnoziarn|bezglut|ryzow|z ciecierzyc|express|kids|mini|nisk\w* ig|\big\b",
         r"vajec|barevn|bezlep|celozrn|plnen|spald|rychlovar|cocka|cizrn"),
    Rule("ovesné vločky", "kg", r"^platki owsian"),
    Rule("olej řepkový", "l", r"^olej rzepak", None, r"sprej|spray|extra panen|lisovan za studena"),
    Rule("olej slunečnicový", "l", r"^olej slonecznik"),
]

_COMPILED = [(r, re.compile(r.include), re.compile(r.exclude) if r.exclude else None) for r in RULES]


def match_rule(name_pl: str) -> Rule | None:
    t = fold(name_pl)
    for rule, inc, exc in _COMPILED:
        if inc.search(t) and not (exc and exc.search(t)):
            return rule
    return None


# ------------------------------------------------------------ ojeb.cz data

_UNIT_PRICE = re.compile(r"([\d\s]+(?:,\d+)?)\s*Kč\s*/\s*(kg|l|ks)\b")
_PACK = re.compile(r"(?:(\d+)\s*[x×]\s*)?(\d+(?:,\d+)?)\s*(kg|g|l|ml|ks)\b")


def _num(s: str) -> float:
    return float(s.replace(" ", "").replace("\xa0", "").replace(",", "."))


def parse_unit_price(text: str | None) -> tuple[float, str] | None:
    m = _UNIT_PRICE.search(text or "")
    return (_num(m.group(1)), m.group(2)) if m else None


def parse_pack(text: str | None) -> tuple[float, str] | None:
    """'250 g' → (0.25, 'kg'); '6x0,5 l' → (3.0, 'l'); 'cena za 1 kg' (loose) → None."""
    if not text or "cena za" in text:
        return None
    m = _PACK.search(text)
    if not m:
        return None
    n = int(m.group(1) or 1) * _num(m.group(2))
    u = m.group(3)
    if u == "g":
        return n / 1000, "kg"
    if u == "ml":
        return n / 1000, "l"
    return n, u


def reference_entries(raw: list[dict], cz_type: str, unit: str, today: str,
                      cz_exclude: str | None = None) -> list[dict]:
    """Czech offers of exactly this kind, open to everybody, valid today."""
    out = []
    exc = re.compile(cz_exclude) if cz_exclude else None
    for o in raw:
        if o.get("product_type") != cz_type or o.get("condition") not in (None, "none"):
            continue
        if exc and exc.search(fold(o.get("name") or "")):
            continue
        if not (o.get("valid_from", "") <= today <= o.get("valid_to", "9999")):
            continue
        up = parse_unit_price(o.get("unit_price"))
        if not up or up[1] != unit or up[0] <= 0:
            continue
        pack = parse_pack(o.get("pack"))
        out.append({
            "unit_price_czk": up[0], "unit": unit,
            "qty": pack[0] if pack and pack[1] == unit else None,
            "chain": o.get("chain"), "name": o.get("name"), "pack": o.get("pack"),
            "url": o.get("url"), "valid_to": o.get("valid_to"),
        })
    out.sort(key=lambda e: e["unit_price_czk"])
    return out


def _ensure_table(con: sqlite3.Connection) -> None:
    con.execute("CREATE TABLE IF NOT EXISTS cz_prices (cz_type TEXT PRIMARY KEY, day TEXT, entries TEXT)")


def fetch_cz_prices(con: sqlite3.Connection, today: date | None = None) -> dict:
    """Refresh the Czech reference prices once a day. Failures keep the last data."""
    from .http import get

    _ensure_table(con)
    day = (today or date.today()).isoformat()
    done = failed = 0
    for cz_type, unit in sorted({(r.cz_type, r.unit) for r in RULES}):
        row = con.execute("SELECT day FROM cz_prices WHERE cz_type=?", (cz_type,)).fetchone()
        if row and row[0] == day:
            continue
        try:
            raw = get(API, params={"q": cz_type, "limit": 200}).json().get("offers", [])
        except Exception:
            failed += 1
            continue
        entries = reference_entries(raw, cz_type, unit, day)  # rule-specific exclusions apply in cz_reference
        con.execute("INSERT OR REPLACE INTO cz_prices (cz_type, day, entries) VALUES (?,?,?)",
                    (cz_type, day, json.dumps(entries, ensure_ascii=False)))
        done += 1
    return {"fetched": done, "failed": failed}


def load_cz_prices(con: sqlite3.Connection, today: date | None = None) -> dict[str, list[dict]]:
    """Reference entries per Czech kind; entries that already expired are dropped."""
    _ensure_table(con)
    day = (today or date.today()).isoformat()
    out: dict[str, list[dict]] = {}
    for r in con.execute("SELECT cz_type, entries FROM cz_prices"):
        es = [e for e in json.loads(r[1] or "[]") if (e.get("valid_to") or "9999") >= day]
        if es:
            out[r[0]] = es
    return out


MAX_PACK_RATIO = 3.0  # big packs are always cheaper per kg – compare similar sizes only
MAX_PRICE_RATIO = 2.0  # a bigger gap is almost always a different product, not a bargain


def cz_reference(name_pl: str, unit_price_pln: float | None, unit_price_unit: str | None,
                 quantity: float | None, refs: dict[str, list[dict]], rate: float | None = None) -> dict | None:
    """Cheapest comparable Czech promotion for a Polish offer, or None."""
    if not unit_price_pln or not unit_price_unit:
        return None
    rule = match_rule(name_pl)
    if not rule or rule.unit != unit_price_unit:
        return None
    exc = re.compile(rule.cz_exclude) if rule.cz_exclude else None
    for e in refs.get(rule.cz_type, []):  # sorted by unit price, cheapest first
        if exc and exc.search(fold(e.get("name") or "")):
            continue
        if quantity and e.get("qty"):
            ratio = max(quantity, e["qty"]) / min(quantity, e["qty"])
            if ratio > MAX_PACK_RATIO:
                continue
        if rate:
            pl_czk = unit_price_pln * rate
            if max(pl_czk, e["unit_price_czk"]) / min(pl_czk, e["unit_price_czk"]) > MAX_PRICE_RATIO:
                return None
        return {"type": rule.cz_type, "unit": rule.unit, "unit_price_czk": e["unit_price_czk"],
                "chain": e["chain"], "name": e["name"], "pack": e["pack"], "url": e["url"],
                "valid_to": e["valid_to"], "source": SOURCE}
    return None
