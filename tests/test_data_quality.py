"""Regression tests for data-quality fixes (Nov 2026). Inputs are real model
outputs copied from the production database."""
from datetime import date

import pytest

from pipeline.extract.vision import box_2d_to_bbox
from pipeline.models import PageSource, RawOffer
from pipeline.normalize import (
    drop_shared_bboxes, normalize, normalize_bbox, parse_conditions, plausible_old_price,
)


def _norm(**kw):
    raw = RawOffer(**{"name": "X", "price_text": "1,00", **kw})
    return normalize(raw, leaflet_id="biedronka:t", store="biedronka", page_no=1,
                     valid_from=date(2026, 11, 16), valid_to=date(2026, 11, 22),
                     page_image_url=None, source=PageSource.vision, rate_czk_per_pln=5.5, idx=0)


# ------------------------------------------------------------------ bbox

@pytest.mark.parametrize("raw,exp", [
    ([0.1, 0.2, 0.5, 0.6], [0.1, 0.2, 0.5, 0.6]),          # fractions as asked
    ([0.049, 236.0, 0.32, 459.0], [0.049, 0.236, 0.32, 0.459]),  # Lidl: y on 0..1000
    ([0.029, 13.0, 0.402, 46.0], [0.029, 0.13, 0.402, 0.46]),    # y in percent
    ([120, 300, 480, 700], [0.12, 0.3, 0.48, 0.7]),        # both axes 0..1000
    ([0.5, 0.6, 0.1, 0.2], [0.1, 0.2, 0.5, 0.6]),          # swapped corners
    ([0.1, 0.2, 0.1, 0.6], None),                          # zero width
    ([0.1, 0.2, 0.5], None), (None, None), ([0.1, "a", 0.5, 0.6], None), ([-1, 0, 0.5, 0.6], None),
])
def test_normalize_bbox(raw, exp):
    out = normalize_bbox(raw)
    assert out == (pytest.approx(exp) if exp else None)


def test_box_2d_is_y_first_on_0_1000():
    assert box_2d_to_bbox([236, 49, 459, 320]) == [0.049, 0.236, 0.32, 0.459]
    assert box_2d_to_bbox([0, 0, 1200, 10]) is None
    assert box_2d_to_bbox(None) is None


def test_normalize_stores_fraction_bbox():
    o = _norm(price_text="2,49", bbox=[0.346, 346.0, 0.601, 532.0])
    assert o.bbox == pytest.approx([0.346, 0.346, 0.601, 0.532])


def test_drop_shared_bboxes_only_between_different_products():
    a = _norm(name="Karma dla psa Activ Pet", bbox=[0.36, 0.744, 0.645, 0.909])
    b = _norm(name="Karmy dla psa Dolina Noteci", bbox=[0.36, 0.745, 0.645, 0.909])
    c = _norm(name="Mleko", bbox=[0.0, 0.0, 0.3, 0.3])
    same1 = _norm(name="Napój gazowany", bbox=[0.5, 0.5, 0.9, 0.9])
    same2 = _norm(name="Napój gazowany", bbox=[0.5, 0.5, 0.9, 0.9])
    offers = [a, b, c, same1, same2]
    drop_shared_bboxes(offers)
    assert a.bbox is None and b.bbox is None
    assert c.bbox and same1.bbox and same2.bbox


# ------------------------------------------------- unit price as old price

def test_unit_price_is_not_an_old_price():
    # Pasta do zębów 75 ml 13,49 zł, model read 179,87 zł/l as the old price
    o = _norm(name="Pasta do zębów Aktyw, Sensitive", price_text="13,49", old_price_text="179,87",
              quantity_text="75 ml", unit_price_text="1 l = 179,87")
    assert o.old_price_pln is None and o.discount_pct is None


def test_one_kilo_pack_keeps_old_price_equal_to_unit_price():
    o = _norm(name="Pomarańcze deserowe", price_text="3,99", old_price_text="6,99",
              quantity_text="1 kg", unit_price_text="1 kg = 6,99")
    assert o.old_price_pln == 6.99


@pytest.mark.parametrize("price,old,disc,ok", [
    (2.0, 3.0, None, True),
    (1.0, 7.99, None, False),     # -87 % without a printed discount: misread
    (1.0, 7.99, 87.0, True),      # printed "-87%" vouches for it
    (5.0, 4.0, None, True),       # not a discount at all – left to the caller
])
def test_plausible_old_price(price, old, disc, ok):
    assert plausible_old_price(price, old, None, None, None, disc) is ok


# ------------------------------------------------------------- multibuy

@pytest.mark.parametrize("text,min_qty", [
    ("Drugi za 5 zł", 2), ("drugi za 1 zł, z kartą lub aplikacją", 2), ("trzeci za 1 zł", 3),
    ("drugi 40% taniej", 2), ("2+1 gratis", 3), ("Przy zakupie 2", 2),
])
def test_multibuy_detected(text, min_qty):
    c = parse_conditions(text, "", None)
    assert c.multibuy and c.min_qty == min_qty


def test_second_for_one_zloty_is_averaged_not_a_87_percent_cut():
    # Karma dla kotów Kitty: price_text "1 zł", old "7,99", "Drugi za 1 zł"
    o = _norm(name="Karma dla kotów w saszetkach Kitty", price_text="1 zł", old_price_text="7,99",
              conditions_text="Drugi za 1 zł, z kartą lub aplikacją, limit dzienny 4 opak.")
    assert o.price_pln == 4.5
    assert o.old_price_pln == 7.99
    assert o.conditions.multibuy and o.conditions.min_qty == 2 and o.conditions.app_only
    assert o.conditions.max_qty == 4


def test_third_for_one_zloty():
    o = _norm(name="Napój gazowany", price_text="1 zł", old_price_text="5,49", conditions_text="trzeci za 1 zł")
    assert o.price_pln == round((5.49 * 2 + 1) / 3, 2)
    assert o.conditions.min_qty == 3


def test_second_for_x_with_regular_price_printed():
    o = _norm(name="Karmy dla psa Dolina Noteci", price_text="12,49", conditions_text="Drugi za 5 zł")
    assert o.price_pln == 8.75 and o.old_price_pln == 12.49 and o.conditions.multibuy


# ---------------------------------------------------------------- names

def test_czech_name_from_model():
    o = _norm(name="Mleko UHT 3,2%", name_cs="Mléko UHT 3,2 %", price_text="1,98")
    assert o.name == "Mléko UHT 3,2 %" and o.name_pl == "Mleko UHT 3,2%"


def test_name_falls_back_to_polish():
    o = _norm(name="Mleko UHT 3,2%", price_text="1,98")
    assert o.name == o.name_pl == "Mleko UHT 3,2%"


def test_translate_uses_cache_and_skips_misaligned(monkeypatch, tmp_path):
    import sqlite3
    from pipeline import db as dbm, translate

    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    for i, n in enumerate(["Mleko", "Masło", "Mleko"]):
        con.execute("INSERT INTO offers (id, leaflet_id, store, page_no, name, name_pl, price_pln, valid_from, "
                    "valid_to, source) VALUES (?, 'l', 'lidl', 1, ?, ?, 1, '2026-01-01', '2999-01-01', 'vision')",
                    (f"o{i}", n, n))
    calls = []

    def fake_call(names, model):
        calls.append(list(names))
        return [{"Mleko": "Mléko", "Masło": "Máslo"}[n] for n in names]

    monkeypatch.setattr(translate, "VISION_API_KEY", "x")
    monkeypatch.setattr(translate, "_call", fake_call)
    assert translate.translate_names(con) == 3
    assert {r["name"] for r in con.execute("SELECT name FROM offers")} == {"Mléko", "Máslo"}
    assert calls == [["Masło", "Mleko"]]          # distinct names, one batch
    con.execute("UPDATE offers SET name = name_pl")
    assert translate.translate_names(con) == 3     # second run: cache only
    assert len(calls) == 1


def test_second_item_percent_is_not_the_offer_discount():
    o = _norm(name="Krem uniwersalny", price_text="9,99", old_price_text="16,99", discount_text="-82%",
              conditions_text="DRUGI 82% TANIEJ, KAŻDA Z 2 SZTUK")
    assert o.discount_pct == 41.2
