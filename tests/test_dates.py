"""Per-offer validity. Texts are copied from real leaflets (Nov 2026)."""
from datetime import date

import pytest

from pipeline.dates import offer_validity, parse_valid_text, region_for
from pipeline.extract.page_dates import parse_answer

LF = (date(2026, 11, 12), date(2026, 11, 18))  # Biedronka "Codziennie niskie ceny – oferta od 12.11"


@pytest.mark.parametrize("text,exp", [
    ("CZWARTEK – SOBOTA 12.11-14.11", (date(2026, 11, 12), date(2026, 11, 14))),
    ("PIĄTEK – SOBOTA 13.11-14.11", (date(2026, 11, 13), date(2026, 11, 14))),
    ("PONIEDZIAŁEK – SOBOTA 16.11-21.11, Z KARTĄ LUB APLIKACJĄ", (date(2026, 11, 16), date(2026, 11, 21))),
    ("Limit: 3 kg na paragon. Od pon., 16.11 do sob., 21.11", (date(2026, 11, 16), date(2026, 11, 21))),
    ("Ważny od 5.11.2026 do 2.12.2026. Aktywuj w aplikacji", (date(2026, 11, 5), date(2026, 12, 2))),
    ("TYLKO W PONIEDZIAŁEK 16.11, Z KARTĄ LUB APLIKACJĄ", (date(2026, 11, 16), date(2026, 11, 16))),
    ("Oferta 12.–14.11.", (date(2026, 11, 12), date(2026, 11, 14))),
    ("od 16.11", (date(2026, 11, 16), date(2026, 11, 18))),       # open end → leaflet end
    ("do 14.11", (date(2026, 11, 12), date(2026, 11, 14))),       # open start → leaflet start
])
def test_parse_valid_text(text, exp):
    assert parse_valid_text(text, *LF) == exp


@pytest.mark.parametrize("text", [
    None, "", "Z KARTĄ LUB APLIKACJĄ MOJA BIEDRONKA, PRZY ZAKUPIE 4",
    "1 L = 8,58 + kaucja 6,00 zł -41%",       # prices use a comma
    "butelka 1.5-2.5 l",                       # volumes are not dates (May, far from the leaflet)
    "Najniższa cena z 30 dni przed obniżką: 51,48/12 pusz.",
    "31.02-02.03",                             # impossible date
])
def test_no_validity(text):
    assert parse_valid_text(text, *LF) is None


def test_year_rollover():
    assert parse_valid_text("2.01-4.01", date(2026, 12, 28), date(2027, 1, 4)) == (date(2027, 1, 2), date(2027, 1, 4))


# The duck page (Biedronka, p31): two sections with different days.
REGIONS = [
    {"valid_text": "PIĄTEK – SOBOTA 13.11-14.11", "bbox": [0.0, 0.0, 1.0, 0.55]},
    {"valid_text": "CZWARTEK – SOBOTA 12.11-14.11", "bbox": [0.0, 0.55, 1.0, 1.0]},
]
DUCK = [0.058, 0.736, 0.299, 0.931]
CHICKEN = [0.05, 0.15, 0.3, 0.42]


def test_region_by_tile_centre():
    assert region_for(DUCK, REGIONS)["valid_text"].startswith("CZWARTEK")
    assert region_for(CHICKEN, REGIONS)["valid_text"].startswith("PIĄTEK")
    assert region_for(None, REGIONS) is None


def test_offer_validity_order():
    assert offer_validity(None, DUCK, REGIONS, *LF) == (date(2026, 11, 12), date(2026, 11, 14))
    # Own printed date wins over the section banner
    assert offer_validity("TYLKO W SOBOTĘ 14.11", DUCK, REGIONS, *LF) == (date(2026, 11, 14), date(2026, 11, 14))
    # No regions, no own date → leaflet
    assert offer_validity(None, DUCK, [], *LF) == LF
    # Single banner without a box covers the whole page
    assert offer_validity(None, DUCK, [{"valid_text": "12.11-14.11", "bbox": None}], *LF) == (
        date(2026, 11, 12), date(2026, 11, 14))
    # Two banners without boxes: ambiguous → leaflet
    assert offer_validity(None, DUCK, [{"valid_text": "12.11-14.11", "bbox": None},
                                       {"valid_text": "16.11-18.11", "bbox": None}], *LF) == LF


def test_parse_model_answer():
    out = parse_answer('```json\n{"dates": [{"valid_text": "CZWARTEK – SOBOTA 12.11-14.11", '
                       '"box_2d": [550, 0, 1000, 1000]}, {"valid_text": ""}, "x"]}\n```')
    assert out == [{"valid_text": "CZWARTEK – SOBOTA 12.11-14.11", "bbox": [0.0, 0.55, 1.0, 1.0]}]
    assert parse_answer('{"dates": []}') == []


def test_renormalize_applies_page_dates(tmp_path):
    import json
    import sqlite3

    from pipeline import cli, db as dbm, dates as offer_dates
    from pipeline.models import Leaflet, PageSource, RawOffer

    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    offer_dates.ensure_schema(con)
    lf = Leaflet(id="biedronka:x", store="biedronka", title="t", valid_from=LF[0], valid_to=LF[1],
                 source_url="u", page_image_urls=["https://img/p1.jpg"])
    dbm.upsert_leaflet(con, lf)
    con.execute("INSERT INTO page_dates (leaflet_id, page_no, regions_json) VALUES (?,?,?)",
                (lf.id, 1, json.dumps(REGIONS)))
    raws = [RawOffer(name="Kaczka świeża bez podrobów", price_text="9,99/kg", old_price_text="16,99",
                     quantity_text="za kg", box_2d=None, bbox=[0.058, 0.736, 0.299, 0.931]),
            RawOffer(name="Świeży filet z piersi kurczaka", price_text="14,99/kg", quantity_text="za kg",
                     bbox=CHICKEN)]
    offers = cli._normalize_page(con, lf, 1, raws, PageSource.vision, 5.5)
    got = {o.name_pl: (o.valid_from, o.valid_to) for o in offers}
    assert got["Kaczka świeża bez podrobów"] == (date(2026, 11, 12), date(2026, 11, 14))
    assert got["Świeży filet z piersi kurczaka"] == (date(2026, 11, 13), date(2026, 11, 14))
