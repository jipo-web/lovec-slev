"""Pages are pinned to the image the model read (stores reorder their lists)."""
import base64
import json
import sqlite3
from datetime import date

from pipeline import cli, db as dbm
from pipeline.models import Leaflet, RawOffer

B = "https://images.biedronka.cloud/api/v1/x/2026_FOOD_T47_A_PODSTAWA_P{:02d}_ujce5rfgse.png"
AD = "https://images.biedronka.cloud/api/v1/x/T47A_Folder_INS_169x275_ONLINE_WARKA.png"


def lidl(page: int, h: str) -> str:
    seg = base64.urlsafe_b64encode(f"s3://leaflets/images/01a1/page-{page:02d}_{h}.png".encode()).decode().rstrip("=")
    return f"https://imgproxy.leaflets.schwarz/sig/rs:fit:1200:1200:1/g:no/{seg}.jpg"


def test_page_key():
    assert dbm.page_key(B.format(30)) == "2026_FOOD_T47_A_PODSTAWA_P30_ujce5rfgse"
    assert dbm.page_key(lidl(1, "aaa")) == dbm.page_key(lidl(1, "bbb")) == "page-01"
    assert dbm.page_key(lidl(1, "aaa")) != dbm.page_key(lidl(2, "aaa"))
    assert dbm.page_key(None) is None


def _db(tmp_path):
    con = sqlite3.connect(tmp_path / "t.db")
    con.row_factory = sqlite3.Row
    con.executescript(dbm.SCHEMA)
    return con


def _leaflet(urls):
    return Leaflet(id="biedronka:x", store="biedronka", title="t", valid_from=date(2026, 11, 16),
                   valid_to=date(2999, 1, 1), source_url="u", page_image_urls=urls)


def test_reordered_list_keeps_offers_on_their_image(tmp_path, monkeypatch):
    con = _db(tmp_path)
    read = []

    def fake_extract(path):
        read.append(path.name)
        return [RawOffer(name=f"Produkt z {path.name}", price_text="1,99")], None

    from pipeline.extract import vision
    monkeypatch.setattr(vision, "extract_image", fake_extract)
    monkeypatch.setattr(cli, "download", lambda url, dest: dest)
    monkeypatch.setattr(cli, "_image_cache", lambda lf, url: tmp_path / dbm.page_key(url))

    lf = _leaflet([B.format(1), B.format(2), B.format(3)])
    dbm.upsert_leaflet(con, lf)
    cli._vision_pages(con, lf, 5.5, budget=10)
    assert len(read) == 3

    # Biedronka inserts an ad before page 2 and swaps 2/3
    lf2 = _leaflet([B.format(1), AD, B.format(3), B.format(2)])
    dbm.upsert_leaflet(con, lf2)
    read.clear()
    cli._vision_pages(con, lf2, 5.5, budget=10)
    assert read == [dbm.page_key(AD)]  # only the new page is read

    pages = {r["page_no"]: r["image_url"] for r in con.execute("SELECT page_no, image_url FROM pages")}
    assert pages[2] == B.format(2) and pages[3] == B.format(3)   # untouched
    assert AD in pages.values() and min(p for p, u in pages.items() if u == AD) > 3   # appended, page 2 not overwritten
    # Offers point at the image they were read from
    for r in con.execute("SELECT name_pl, page_image_url FROM offers"):
        assert dbm.page_key(r["page_image_url"]) in r["name_pl"]


def test_reissued_lidl_image_followed_without_model_call(tmp_path, monkeypatch):
    con = _db(tmp_path)
    from pipeline.extract import vision
    calls = []
    monkeypatch.setattr(vision, "extract_image", lambda p: (calls.append(p), ([RawOffer(name="X", price_text="1")], None))[1])
    monkeypatch.setattr(cli, "download", lambda url, dest: dest)
    monkeypatch.setattr(cli, "_image_cache", lambda lf, url: tmp_path / "img")
    lf = _leaflet([lidl(1, "old")])
    dbm.upsert_leaflet(con, lf)
    cli._vision_pages(con, lf, 5.5, budget=10)
    lf2 = _leaflet([lidl(1, "new")])
    cli._vision_pages(con, lf2, 5.5, budget=10)
    assert len(calls) == 1
    assert con.execute("SELECT image_url FROM pages").fetchone()[0] == lidl(1, "new")


def test_migration_pins_from_fix_file(tmp_path, monkeypatch):
    con = sqlite3.connect(tmp_path / "m.db")
    con.row_factory = sqlite3.Row
    # old schema without image_url
    con.executescript(dbm.SCHEMA.replace("  image_url TEXT,              -- image the model read (pinned; store lists get reordered)\n", ""))
    con.executescript("CREATE TABLE page_boxes (leaflet_id TEXT, page_no INTEGER, boxes_json TEXT, model TEXT, created_at TEXT);")
    old = [B.format(1), B.format(2)]
    new = [AD, B.format(1), B.format(2)]
    lf = _leaflet(new)
    dbm.upsert_leaflet(con, lf)
    for p in (1, 2):
        con.execute("INSERT INTO pages (leaflet_id, page_no, method, raw_json) VALUES ('biedronka:x', ?, 'vision', '[]')", (p,))
        con.execute("INSERT INTO page_boxes VALUES ('biedronka:x', ?, '{}', 'm', 'now')", (p,))
    fix = tmp_path / "fix.json"
    fix.write_text(json.dumps({"lists": {"biedronka:x": old}}))
    monkeypatch.setattr(dbm, "_FIXES", fix)
    dbm.migrate(con)
    assert [r[0] for r in con.execute("SELECT image_url FROM pages ORDER BY page_no")] == old
    assert con.execute("SELECT COUNT(*) FROM page_boxes").fetchone()[0] == 0   # computed on shifted images
    dbm.migrate(con)  # idempotent
