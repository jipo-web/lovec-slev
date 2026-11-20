"""Czech reference prices (ojeb.cz): which Polish offers get compared, and with what."""
import pytest

from pipeline.czprices import cz_reference, match_rule, parse_pack, parse_unit_price, reference_entries


@pytest.mark.parametrize("name,cz_type", [
    ("Masło Ekstra z Polskiej Mleczarni", "máslo"),
    ("Mleko UHT 3,2% Łączka", "mléko"),
    ("Banany, luzem", "banány"),
    ("Świeży filet z piersi kurczaka", "kuřecí prsa"),
    ("Mąka pszenna tortowa, typ 450", "mouka"),
    ("Cukier biały", "cukr"),
    ("Pomidory na gałązce", "rajčata"),
    ("Ser gouda w plastrach, XXL", "sýr"),
])
def test_uniform_goods_are_matched(name, cz_type):
    assert match_rule(name).cz_type == cz_type


@pytest.mark.parametrize("name", [
    "Pasztecik z pieczarkami",          # not mushrooms – anchored to the start
    "Pomarańcza suszona 150g",          # dried fruit
    "Pizza Suprema",                    # branded / processed goods are left out
    "Piwo Birra Moretti",
    "Czekolada mleczna",
    "Kiełbasa śląska",
    "Masło orzechowe",                  # peanut butter is not butter
    "Mleko kokosowe",
    "Pomidor koktajlowy gałązka",       # cherry tomatoes ≠ tomatoes on the vine
    "Ser salami w plastrach",
    "Makaron Fusilli niskie IG",
])
def test_other_goods_are_not_matched(name):
    assert match_rule(name) is None


def test_parsers():
    assert parse_unit_price("131,60 Kč/kg") == (131.6, "kg")
    assert parse_unit_price("1 299,00 Kč/kg") == (1299.0, "kg")
    assert parse_pack("250 g") == (0.25, "kg")
    assert parse_pack("6x0,5 l") == (3.0, "l")
    assert parse_pack("cena za 1 kg") is None


RAW = [
    {"product_type": "máslo", "condition": "none", "valid_from": "2026-11-18", "valid_to": "2026-11-24",
     "unit_price": "99,60 Kč/kg", "pack": "250 g", "chain": "Tesco", "name": "Tesco Máslo", "url": "u1"},
    {"product_type": "máslo", "condition": "card", "valid_from": "2026-11-18", "valid_to": "2026-11-24",
     "unit_price": "79,60 Kč/kg", "pack": "250 g", "chain": "Lidl", "name": "Máslo", "url": "u2"},
    {"product_type": "máslo", "condition": "none", "valid_from": "2026-11-18", "valid_to": "2026-11-24",
     "unit_price": "89,90 Kč/kg", "pack": "250 g", "chain": "Billa", "name": "Pomazánkové máslo", "url": "u3"},
    {"product_type": "máslo", "condition": "none", "valid_from": "2026-11-18", "valid_to": "2026-11-24",
     "unit_price": "70,00 Kč/kg", "pack": "2 kg", "chain": "Makro", "name": "Máslo", "url": "u4"},
]


def test_reference_is_cheapest_comparable_czech_offer():
    refs = {"máslo": reference_entries(RAW, "máslo", "kg", "2026-11-20")}
    assert [e["url"] for e in refs["máslo"]] == ["u4", "u3", "u1"]  # card-only offer dropped
    ref = cz_reference("Masło Ekstra", 14.95, "kg", 0.2, refs, rate=5.5)
    # 2 kg pack is too big to compare, "pomazánkové máslo" is another product
    assert ref["url"] == "u1" and ref["unit_price_czk"] == 99.6 and ref["source"] == "ojeb.cz"


def test_no_reference_for_implausible_gap_or_other_unit():
    refs = {"máslo": reference_entries(RAW, "máslo", "kg", "2026-11-20")}
    assert cz_reference("Masło Ekstra", 60.0, "kg", 0.2, refs, rate=5.5) is None   # 330 vs 99.6 Kč/kg
    assert cz_reference("Masło Ekstra", 14.95, "l", 0.2, refs, rate=5.5) is None
    assert cz_reference("Masło Ekstra", 14.95, "kg", 0.2, {}, rate=5.5) is None
