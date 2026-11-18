"""Product photo boxes (locate) and pre-cut WebP images (crops)."""
import json
import sqlite3
from datetime import date, timedelta

from PIL import Image

from pipeline import cli, crops, db as dbm
from pipeline.extract import locate
from pipeline.models import Leaflet, Offer, PageSource, RawOffer


def test_parse_boxes_keeps_photo_inside_tile():
    out = locate.parse_boxes('{"boxes": ['
                             '{"id": 1, "box_2d": [500, 0, 1000, 500], "photo_2d": [520, 20, 800, 480]},'
                             '{"id": 2, "box_2d": [0, 0, 400, 500], "photo_2d": null},'
                             '{"id": 3, "box_2d": [0, 500, 400, 1000], "photo_2d": [0, 0, 400, 400]},'   # other tile
                             '{"id": 4, "box_2d": [500, 500, 1000, 1000], "photo_2d": [600, 600, 605, 610]}'  # speck
                             ']}', {1, 2, 3, 4})
    assert out[1] == {"bbox": [0.0, 0.5, 0.5, 1.0], "photo": [0.02, 0.52, 0.48, 0.8]}
    assert out[2]["photo"] is None and out[3]["photo"] is None and out[4]["photo"] is None
    # the old tile-only API still works
    assert locate.parse_answer('{"boxes": [{"id": 1, "box_2d": [500, 0, 1000, 500]}]}', {1}) == {1: [0.0, 0.5, 0.5, 1.0]}


def test_photo_box_reaches_the_offer(tmp_path):
    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    dbm.migrate(con)
    locate.ensure_schema(con)
    lf = Leaflet(id="lidl:x", store="lidl", title="t", valid_from=date(2026, 11, 16),
                 valid_to=date(2026, 11, 21), source_url="u", page_image_urls=["https://img/p1.jpg"])
    dbm.upsert_leaflet(con, lf)
    con.execute("INSERT INTO page_boxes (leaflet_id, page_no, boxes_json) VALUES (?,?,?)", (lf.id, 1, json.dumps({
        "0": {"name": "Mango", "bbox": [0.0, 0.5, 0.5, 1.0], "photo": [0.02, 0.52, 0.48, 0.8]}})))
    offers = cli._normalize_page(con, lf, 1, [RawOffer(name="Mango", price_text="3,99")], PageSource.vision, 5.5)
    assert offers[0].photo_bbox == [0.02, 0.52, 0.48, 0.8]
    stored = dbm.all_offers(con)[0]
    assert stored.photo_bbox == [0.02, 0.52, 0.48, 0.8] and stored.image_url is None


def test_relocate_only_pages_without_photo_boxes(tmp_path, monkeypatch):
    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    dbm.migrate(con)
    locate.ensure_schema(con)
    today = date.today()
    lf = Leaflet(id="lidl:x", store="lidl", title="t", valid_from=today, valid_to=today + timedelta(days=3),
                 source_url="u", page_image_urls=[f"https://img/p{i}.jpg" for i in (1, 2, 3, 4)])
    dbm.upsert_leaflet(con, lf)
    for n in (1, 2, 3, 4):
        dbm.save_page(con, lf.id, n, "vision", [RawOffer(name=f"P{n}", price_text="1,99").model_dump()],
                      image_url=f"https://img/p{n}.jpg")
        cli._normalize_page(con, lf, n, [RawOffer(name=f"P{n}", price_text="1,99")], PageSource.vision, 5.5)
    old = {"0": {"name": "P1", "bbox": [0, 0, 0.5, 0.5]}}
    new = {"0": {"name": "P2", "bbox": [0, 0, 0.5, 0.5], "photo": None}}
    for n, b in ((1, old), (2, new), (3, {})):
        con.execute("INSERT INTO page_boxes (leaflet_id, page_no, boxes_json) VALUES (?,?,?)", (lf.id, n, json.dumps(b)))
    seen = []
    monkeypatch.setattr(cli, "download", lambda url, dest: dest)
    monkeypatch.setattr(cli.boxes, "locate", lambda img, products: seen.append(products[0]["name"]) or {})
    cli.cmd_locate(con, 10)
    assert sorted(seen) == ["P1", "P4"]  # old entry without photo + page without entry


def _offer(**kw) -> Offer:
    base = dict(id="lidl:x:p1:0", leaflet_id="lidl:x", store="lidl", page_no=1, name="Mango", name_pl="Mango",
                price_pln=3.99, valid_from=date.today(), valid_to=date.today() + timedelta(days=3),
                page_image_url="https://img/p1.jpg")
    base.update(kw)
    return Offer(**base)


def test_crop_box_photo_and_tile():
    box, kind = crops.crop_box(_offer(bbox=[0.1, 0.1, 0.5, 0.5], photo_bbox=[0.2, 0.2, 0.4, 0.3]), 1000, 1400)
    assert kind == "photo" and box[0] < 0.2 and box[2] > 0.4
    # a flat price strip is widened to a readable shape
    box, kind = crops.crop_box(_offer(bbox=[0.1, 0.5, 0.9, 0.56]), 1000, 1400)
    w, h = (box[2] - box[0]) * 1000, (box[3] - box[1]) * 1400
    assert kind == "tile" and w / h <= crops.MAX_ASPECT + 0.01
    assert crops.crop_box(_offer(bbox=[0.1, 0.1, 0.11, 0.11]), 1000, 1400) is None
    assert crops.crop_box(_offer(), 1000, 1400) is None


def test_make_crops_and_build(tmp_path, monkeypatch):
    monkeypatch.setattr(crops, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(crops, "MEDIA_DIR", tmp_path / "data" / "media")
    monkeypatch.setattr(crops, "CACHE_DIR", tmp_path / "cache")
    monkeypatch.setattr(crops, "OUT_DIR", tmp_path / "public" / "data")
    monkeypatch.setattr(crops, "WEB_MEDIA_DIR", tmp_path / "public" / "media")
    page = tmp_path / "page.png"
    Image.new("RGB", (2400, 3400), "white").save(page)
    fetched = []

    def fake_download(url, dest):
        fetched.append(url)
        return page

    monkeypatch.setattr(crops, "download", fake_download)
    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    dbm.migrate(con)
    lf = Leaflet(id="lidl:x", store="lidl", title="t", valid_from=date.today(),
                 valid_to=date.today() + timedelta(days=3), source_url="u", page_image_urls=["https://img/p1.jpg"],
                 extra={"zoom_urls": {"https://img/p1.jpg": "https://img/p1-zoom.jpg"}})
    dbm.upsert_leaflet(con, lf)
    dbm.replace_offers(con, lf.id, 1, [
        _offer(bbox=[0.0, 0.5, 0.5, 1.0], photo_bbox=[0.02, 0.52, 0.48, 0.8]),
        _offer(id="lidl:x:p1:1", name="B", name_pl="B", bbox=[0.5, 0.5, 1.0, 1.0]),
        _offer(id="lidl:x:p1:2", name="C", name_pl="C"),
    ])
    stats = crops.make_crops(con)
    assert stats == {"photo": 1, "tile": 1, "new": 2, "failed_pages": 0}
    assert fetched == ["https://img/p1-zoom.jpg"]  # the sharp version, once per page
    imgs = crops.offer_images(con)
    assert set(imgs) == {"lidl:x:p1:0", "lidl:x:p1:1"}
    with Image.open(tmp_path / "data" / imgs["lidl:x:p1:0"]) as im:
        assert im.format == "WEBP" and max(im.size) == crops.MAX_SIDE
    # second run: nothing to download or cut; stale files are pruned
    stale = tmp_path / "data" / "media" / "lidl" / "old.webp"
    stale.write_bytes(b"x")
    assert crops.make_crops(con)["new"] == 0 and len(fetched) == 1 and not stale.exists()
    crops.publish(set(imgs.values()))
    assert (tmp_path / "public" / imgs["lidl:x:p1:1"]).exists()
