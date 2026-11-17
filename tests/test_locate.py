"""Precise product tiles (extract/locate.py) and their use in normalisation."""
import json
import sqlite3
from datetime import date

from pipeline import cli, db as dbm
from pipeline.extract import locate
from pipeline.models import Leaflet, PageSource, RawOffer


def test_prompt_lists_products_and_hints():
    p = locate.build_prompt([{"id": 1, "name": "Kaczka świeża", "price": "9,99/kg"},
                             {"id": 2, "name": "Papier toaletowy", "hint": (0.4177, 0.214)}])
    assert "1. Kaczka świeża – 9,99/kg" in p
    assert "2. Papier toaletowy (punkt na kafelku: y=214, x=418)" in p
    assert "punkt podany przy produkcie" in p
    assert "punkt podany" not in locate.build_prompt([{"id": 1, "name": "X"}])


def test_parse_answer_filters_bad_boxes():
    out = locate.parse_answer('```json\n{"boxes": ['
                              '{"id": 1, "box_2d": [550, 40, 950, 520]},'   # good tile
                              '{"id": 2, "box_2d": [100, 100, 115, 130]},'  # sliver (price tag only)
                              '{"id": 3, "box_2d": [0, 0, 1000, 1000]},'    # whole page
                              '{"id": 9, "box_2d": [0, 0, 500, 500]},'      # unknown id
                              '{"id": "x"}]}\n```', {1, 2, 3})
    assert out == {1: [0.04, 0.55, 0.52, 0.95]}


def test_precise_box_overrides_extraction_box(tmp_path):
    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    locate.ensure_schema(con)
    lf = Leaflet(id="biedronka:x", store="biedronka", title="t", valid_from=date(2026, 11, 12),
                 valid_to=date(2026, 11, 18), source_url="u", page_image_urls=["https://img/p1.jpg"])
    dbm.upsert_leaflet(con, lf)
    con.execute("INSERT INTO page_boxes (leaflet_id, page_no, boxes_json) VALUES (?,?,?)", (lf.id, 1, json.dumps({
        "0": {"name": "Kaczka świeża bez podrobów", "bbox": [0.05, 0.6, 0.6, 0.98]},
        "1": {"name": "Jiný název", "bbox": [0.5, 0.0, 0.95, 0.4]},   # name mismatch → ignored
    })))
    raws = [RawOffer(name="Kaczka świeża bez podrobów", price_text="9,99/kg", bbox=[0.058, 0.736, 0.299, 0.79]),
            RawOffer(name="Świeży filet z piersi kurczaka", price_text="14,99/kg", bbox=[0.05, 0.15, 0.3, 0.42])]
    offers = cli._normalize_page(con, lf, 1, raws, PageSource.vision, 5.5)
    assert offers[0].bbox == [0.05, 0.6, 0.6, 0.98]
    assert offers[1].bbox == [0.05, 0.15, 0.3, 0.42]
