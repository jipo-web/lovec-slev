from datetime import date

import pytest

from pipeline.models import PageSource, RawOffer
from pipeline.normalize import (
    effective_unit_price, normalize, normalize_category, normalize_name_for_matching,
    parse_conditions, parse_discount, parse_price, parse_quantity, parse_unit_price_text,
)


@pytest.mark.parametrize("text,exp", [
    ("4,99", 4.99), ("4.99", 4.99), ("4,99 zł", 4.99), ("14,99/kg", 14.99),
    ("1299", 12.99), ("499", 4.99), ("199", 199.0), ("2 za 9,98", 4.99),
    ("0,99 zł/szt", 0.99), ("od 3,49", 3.49), ("abc", None), ("", None),
    ("0,01", None), ("99999", None), ("3 za 10", 3.33),
])
def test_parse_price(text, exp):
    assert parse_price(text) == exp


def test_whole_zloty_prices():
    from pipeline.normalize import whole_zloty_context
    # Biedronka Home: "269 zł/szt." next to crossed-out "379" – an ice maker, not 2,69 zł
    assert whole_zloty_context("269", "379", "domacnost")
    assert parse_price("269", whole_zloty=True) == 269.0
    assert parse_price("1499", whole_zloty=True) == 1499.0
    # one price can only be whole zloty → so is the other one
    assert whole_zloty_context("139", "299", "ostatni")
    # food with superscript grosze stays as before
    assert not whole_zloty_context("499", "699", "mlecne")


@pytest.mark.parametrize("text,exp", [
    ("500 g", (0.5, "kg")), ("1 kg", (1.0, "kg")), ("1,5 l", (1.5, "l")),
    ("750 ml", (0.75, "l")), ("6 x 0,5 l", (3.0, "l")), ("3 x 200 g", (0.6, "kg")),
    ("10 szt.", (10, "ks")), ("op. 20 szt", (20, "ks")), ("za kg", (1.0, "kg")),
    ("cena za kg", (1.0, "kg")), ("100 g", (0.1, "kg")), ("1 szt.", (1, "ks")),
    ("250 g + 50 g gratis", (0.3, "kg")), ("4 x 100 g", (0.4, "kg")), ("2 l", (2.0, "l")),
    ("szt", (1, "ks")),
])
def test_parse_quantity(text, exp):
    q, u, cleaned = parse_quantity(text)
    assert (pytest.approx(q), u) == (pytest.approx(exp[0]), exp[1])
    assert cleaned


def test_parse_quantity_none_and_name():
    assert parse_quantity(None) == (None, None, None)
    assert parse_quantity("abc")[:2] == (None, None)
    q, u, c = parse_quantity(None, name="Masło Ekstra Mlekovita 200 g")
    assert (q, u, c) == (0.2, "kg", "200 g")
    # model code must not be read as quantity
    assert parse_quantity(None, name="Papier toalet. Lavenda A10x220l 3w 28,6m")[:2] == (None, None)


def test_discount():
    assert parse_discount("-30%") == 30.0
    assert parse_discount("30% taniej") == 30.0
    assert parse_discount("taniej o 30%") == 30.0
    assert parse_discount("taniej o 2 zł") is None
    assert parse_discount(None) is None


def test_conditions():
    c = parse_conditions("z aplikacją Moja Biedronka", "4,99", None)
    assert c.app_only and not c.multibuy
    assert parse_conditions("Lidl Plus", "1,99", None).app_only
    assert parse_conditions("Kaufland Card", "1,99", None).app_only
    assert parse_conditions("kupon", "1,99", None).app_only
    assert not parse_conditions(None, "1,99", None).app_only
    c = parse_conditions("2+1 gratis", "3,99", None)
    assert c.multibuy and c.min_qty == 3
    c = parse_conditions("1+1", "3,99", None)
    assert c.multibuy and c.min_qty == 2
    c = parse_conditions("drugi produkt -50%", "3,99", None)
    assert c.multibuy and c.min_qty == 2
    c = parse_conditions("przy zakupie 3 szt.", "3,99", None)
    assert c.multibuy and c.min_qty == 3
    c = parse_conditions(None, "2 za 9,98", None)
    assert c.multibuy and c.min_qty == 2
    c = parse_conditions("3 szt. w cenie 2", "3,99", None)
    assert c.multibuy and c.min_qty == 3
    assert parse_conditions("w zestawie", "3,99", None).multibuy
    assert parse_conditions("limit 3 szt.", "1", None).max_qty == 3
    assert parse_conditions("max. 5 szt. na klienta", "1", None).max_qty == 5
    assert parse_conditions("maks. 2 opak.", "1", None).max_qty == 2
    assert parse_conditions("limit dzienny 3", "1", None).max_qty == 3
    assert parse_conditions("x" * 300, "1", None).text == "x" * 120
    assert parse_conditions(None, "1,99", None).text is None


def test_unit_prices():
    assert effective_unit_price(4.99, 0.5, "kg") == (9.98, "kg")
    assert effective_unit_price(5.0, 10, "ks") == (0.5, "ks")
    assert effective_unit_price(5.0, None, None) == (None, None)
    assert parse_unit_price_text("9,98 zł / kg") == (9.98, "kg")
    assert parse_unit_price_text("1 l = 3,98 zł") == (3.98, "l")
    assert parse_unit_price_text("100 g = 1,20 zł") == (12.0, "kg")
    assert parse_unit_price_text("nic") == (None, None)


@pytest.mark.parametrize("text,name,exp", [
    ("nabiał", None, "mlecne"), ("ostatni", "Masło Ekstra", "mlecne"),
    ("ostatni", "Ser żółty Gouda", "mlecne"), ("ostatni", "Jogurt naturalny", "mlecne"),
    ("ostatni", "Filet z kurczaka", "maso_ryby"), ("ostatni", "Łosoś norweski", "maso_ryby"),
    ("ostatni", "Kiełbasa śląska", "uzeniny"), ("ostatni", "Parówki", "uzeniny"),
    ("ostatni", "Piwo Tyskie", "alkohol"), ("ostatni", "Kawa mielona", "kava_caj"),
    ("ostatni", "Proszek do prania", "drogerie"), ("ostatni", "Pomidory", "ovoce_zelenina"),
    ("ostatni", "Winogrona", "ovoce_zelenina"), ("ostatni", "Chleb razowy", "pecivo"),
    ("ostatni", "Czekolada mleczna", "sladkosti"), ("ostatni", "Sok jabłkowy", "napoje"),
    ("ostatni", "Warzywa mrożone", "mrazene"), ("ostatni", "Karma dla psa", "zvirata"),
    ("ostatni", "Pieluchy Pampers", "deti"), ("mléčné výrobky", None, "mlecne"),
    ("maso_ryby", None, "maso_ryby"), ("Pečivo", None, "pecivo"),
    ("coś dziwnego", "xyz", "ostatni"), (None, None, "ostatni"),
])
def test_category(text, name, exp):
    assert normalize_category(text, name) == exp


def test_name_for_matching():
    assert normalize_name_for_matching("Masło Ekstra, Mlekovita 200 g") == "maslo ekstra mlekovita"
    assert normalize_name_for_matching("Łosoś  ŻÓŁTY 3 x 200 g!") == "losos zolty"
    assert normalize_name_for_matching("Mąka 1 kg") == "maka"


KW = dict(valid_from=date(2026, 11, 16), valid_to=date(2026, 11, 22),
          page_image_url="http://x/1.jpg", source=PageSource.vision, rate_czk_per_pln=5.7)


def test_normalize_biedronka_multibuy_app():
    raw = RawOffer(name="Jogurt naturalny Bakoma  ", quantity_text="350 g", price_text="2 za 9,98",
                   discount_text="-30%", conditions_text="z aplikacją Moja Biedronka, limit 4 szt.",
                   category="nabiał")
    o = normalize(raw, leaflet_id="biedronka:1", store="biedronka", page_no=3, idx=7, **KW)
    assert o.id == "biedronka:1:p3:7"
    assert o.price_pln == 4.99 and o.price_czk == 28.44
    assert o.quantity == pytest.approx(0.35) and o.unit == "kg"
    assert o.unit_price_pln == 14.26 and o.unit_price_unit == "kg"
    assert o.discount_pct == 30.0 and o.category == "mlecne"
    assert o.conditions.app_only and o.conditions.multibuy
    assert o.conditions.min_qty == 2 and o.conditions.max_qty == 4
    assert o.name == "Jogurt naturalny Bakoma" == o.name_pl


def test_normalize_lidl_plain():
    raw = RawOffer(name="Masło Ekstra Mlekovita 200 g.", price_text="6,49 zł", old_price_text="7,99",
                   category="ostatni")
    o = normalize(raw, leaflet_id="lidl:1", store="lidl", page_no=1, idx=0, **KW)
    assert o.price_pln == 6.49 and o.old_price_pln == 7.99
    assert o.discount_pct == 18.8
    assert (o.quantity, o.unit, o.quantity_text) == (0.2, "kg", "200 g")
    assert o.unit_price_pln == 32.45
    assert o.category == "mlecne"
    assert not o.conditions.app_only and not o.conditions.multibuy


def test_normalize_dino_structured():
    raw = RawOffer(name="Papier toalet. mię/wytrz Lavenda A10x220l 3w 28,6m", price_text="9.89")
    o = normalize(raw, leaflet_id="dino:1", store="dino", page_no=2, idx=4,
                  **{**KW, "source": PageSource.structured})
    assert o.price_pln == 9.89 and o.quantity is None and o.unit_price_pln is None
    assert o.category == "drogerie"
    assert o.name.endswith("28,6m")


def test_normalize_bad_price():
    assert normalize(RawOffer(name="X", price_text="gratis"), leaflet_id="a", store="lidl",
                     page_no=1, idx=0, **KW) is None
