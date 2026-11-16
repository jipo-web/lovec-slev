"""Offline tests for source parsers (no network)."""
from datetime import date

from pipeline.sources import dino
from pipeline.sources.biedronka import _dates_from_slug, _is_food
from pipeline.sources.schwarz import _FLYER_RE, _unescape, is_food


def test_devalue_decodes_nuxt_payload():
    payload = [{"data": 1}, {"leaflets-list": 2}, {"standard": 3}, [4], ["Reactive", 5],
               {"id": 6, "name": 7, "pages": 8}, 361, "Gazetka 46", []]
    out = dino.devalue(payload)
    assert out["data"]["leaflets-list"]["standard"][0] == {"id": 361, "name": "Gazetka 46", "pages": []}


def test_dino_entry_to_leaflet_collects_hotspots():
    entry = {
        "id": 361, "name": "Gazetka 46 / 2026", "activeFrom": "2026-11-12 00:00:00", "activeTo": "2026-11-17 22:30:00",
        "pdf": {"file": "https://api.marketdino.pl/x.pdf"},
        "pages": [{"no": 1, "file": {"file": "https://api.marketdino.pl/p1.webp"},
                   "hotspots": [{"ean": "590", "product": {"name": "Pomidor kg", "price": "7.99"}, "xPosition": 10, "yPosition": 20}]}],
    }
    lf = dino.leaflet_from_entry(entry)
    assert lf.id == "dino:361" and lf.valid_from == date(2026, 11, 12) and lf.pages == 1
    assert lf.extra["products"][0]["name"] == "Pomidor kg"


def test_biedronka_slug_dates():
    today = date(2026, 11, 16)
    assert _dates_from_slug("codziennie-niskie-ceny-p-oferta-od-16-11", today)[:2] == (date(2026, 11, 16), date(2026, 11, 21))
    assert _dates_from_slug("hity-i-inspiracje-12-11", today)[:2] == (date(2026, 11, 12), date(2026, 11, 18))
    assert _is_food("codziennie-niskie-ceny-p-oferta-od-16-11") and not _is_food("home-od-14-11")


def test_schwarz_overview_regex_and_food():
    html = '<a href="x" class="flyer" id="flyer-01a1d53d-7391-7c8a-be92-c319ea6fffa1" data-track-flyer data-track-name="Katalog&#x20;zabawek">'
    assert _FLYER_RE.findall(html) == [("01a1d53d-7391-7c8a-be92-c319ea6fffa1", "Katalog&#x20;zabawek")]
    assert _unescape("Katalog&#x20;zabawek") == "Katalog zabawek"
    assert is_food("Gazetka", "16.11", "Katalogi") and not is_food("Katalog zabawek", "", "")
