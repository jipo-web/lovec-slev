"""Command line: python -m pipeline <command>

  discover            find current leaflets in all sources, store new ones
  fetch               download PDFs (Lidl/Kaufland/Dino); Biedronka/Dino images are used by URL
  extract [--vision]  structured + text-layer extraction; --vision also runs the model on
                      Biedronka pages and on PDF pages where the text layer found nothing
  score               product matching + scoring for offers valid today or later
  renormalize         re-run normalisation on stored model output (free)
  translate           optional: Czech names (cheap text model); not part of run, the web shows Polish names
  build               write public/data/*.json
  dates [--vision]    date banners of page sections ("czw.–sob. 12.11-14.11"), cheap model call
  locate [--vision]   precise product tiles for the crops on the web, cheap model call
  run [--vision]      all of the above
  verify              one leaflet per store: counts, sample offers, cost estimate
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from . import db as dbm
from . import dates as offer_dates
from .build import build
from .config import CACHE_DIR, LOCATE_MAX_PAGES_PER_RUN, VISION_MAX_PAGES_PER_RUN
from .extract import locate as boxes, structured, text_layer
from .http import download
from .match import assign_product_ids
from .models import Leaflet, Offer, PageSource, RawOffer
from .normalize import drop_shared_bboxes, normalize
from .rates import czk_per_pln
from .score import score_offers
from .sources import SOURCES


def cmd_discover(con, stores: list[str] | None = None) -> list[Leaflet]:
    new: list[Leaflet] = []
    for name, fn in SOURCES.items():
        if stores and name not in stores:
            continue
        try:
            found = fn()
        except Exception as e:
            print(f"[{name}] discovery FAILED: {e}", file=sys.stderr)
            continue
        added = [lf for lf in found if dbm.upsert_leaflet(con, lf)]
        new.extend(added)
        print(f"[{name}] {len(found)} leaflets, {len(added)} new")
    return new


def cmd_fetch(con, pdfs: bool = False) -> None:
    """Mark leaflets ready. PDFs (30+ MB each) are only downloaded with --pdf;
    extraction works from the page images the APIs serve."""
    for lf in dbm.leaflets_by_status(con, "discovered"):
        if pdfs and lf.pdf_url and lf.store in ("lidl", "kaufland"):
            dest = CACHE_DIR / lf.store / f"{lf.id.split(':', 1)[1]}.pdf"
            try:
                download(lf.pdf_url, dest)
                dbm.set_status(con, lf.id, "fetched", str(dest))
                print(f"[{lf.store}] fetched {lf.title} ({dest.stat().st_size // 1024} kB)")
            except Exception as e:
                print(f"[{lf.store}] fetch FAILED {lf.title}: {e}", file=sys.stderr)
                dbm.set_status(con, lf.id, "failed")
        else:
            dbm.set_status(con, lf.id, "fetched")  # images are referenced by URL


def _image_cache(lf: Leaflet, url: str) -> Path:
    """Cache file per image URL (not per page number: stores reorder their page lists)."""
    import hashlib
    return CACHE_DIR / lf.store / f"{lf.id.split(':')[1]}-{hashlib.sha1(url.encode()).hexdigest()[:12]}.jpg"


def _normalize_page(con, lf: Leaflet, page_no: int, raws: list[RawOffer], source: PageSource, rate: float,
                    image_url: str | None = None) -> list[Offer]:
    """`image_url`: the image the model just read (pins the page); otherwise the pinned one is used."""
    img = image_url or dbm.page_image(con, lf, page_no)
    regions = offer_dates.page_regions(con, lf.id, page_no)
    precise = boxes.page_boxes(con, lf.id, page_no)
    offers, own_texts = [], []
    for i, r in enumerate(raws):
        p = precise.get(i)
        if p and p.get("name") == r.name and p.get("bbox"):
            r = r.model_copy(update={"bbox": p["bbox"]})
        o = normalize(r, leaflet_id=lf.id, store=lf.store, page_no=page_no, valid_from=lf.valid_from,
                      valid_to=lf.valid_to, page_image_url=img, source=source, rate_czk_per_pln=rate, idx=i)
        if o:
            offers.append(o)
            own_texts.append(" ".join(filter(None, (r.conditions_text, r.discount_text))))
    drop_shared_bboxes(offers)
    tiles = [o.bbox for o in offers if o.bbox]
    for o, own_text in zip(offers, own_texts):
        o.valid_from, o.valid_to = offer_dates.offer_validity(own_text, o.bbox, regions,
                                                              lf.valid_from, lf.valid_to, tiles)
    dbm.save_page(con, lf.id, page_no, source.value, [r.model_dump() for r in raws], needs_review=not offers,
                  image_url=img if page_no > 0 else None)
    dbm.replace_offers(con, lf.id, page_no, offers)
    return offers


def cmd_renormalize(con) -> int:
    """Re-run normalisation on the stored model output of all current pages.

    Free (no model calls): improvements in normalize.py reach offers that were
    extracted before the change. Czech names already translated are kept.
    """
    rate = czk_per_pln(con)
    today = date.today().isoformat()
    kept = {r["name_pl"]: r["name"] for r in con.execute(
        "SELECT name_pl, name FROM offers WHERE name != name_pl")}
    n = 0
    for row in con.execute("SELECT * FROM leaflets WHERE valid_to>=?", (today,)).fetchall():
        lf = dbm.row_to_leaflet(row)
        for p in con.execute("SELECT page_no, method, raw_json FROM pages WHERE leaflet_id=?", (lf.id,)).fetchall():
            raws = []
            for d in json.loads(p["raw_json"] or "[]"):
                try:
                    raws.append(RawOffer(**d))
                except Exception:
                    continue
            offers = _normalize_page(con, lf, p["page_no"], raws, PageSource(p["method"]), rate)
            for o in offers:
                if o.name == o.name_pl and o.name_pl in kept:
                    o.name = kept[o.name_pl]
            dbm.replace_offers(con, lf.id, p["page_no"], offers)
            n += len(offers)
    return n


IMAGE_STORES = ("biedronka", "lidl", "kaufland")  # page images from the store API → vision model


def cmd_locate(con, limit_pages: int = LOCATE_MAX_PAGES_PER_RUN) -> int:
    """Ask the model for precise product tiles on every current page that has
    offers and no entry in page_boxes yet. Returns the number of pages done."""
    from .extract.vision import VISION_MODEL

    boxes.ensure_schema(con)
    today = date.today().isoformat()
    rows = con.execute(
        "SELECT p.leaflet_id, p.page_no, p.raw_json FROM pages p "
        "JOIN leaflets l ON l.id = p.leaflet_id "
        "LEFT JOIN page_boxes b ON b.leaflet_id = p.leaflet_id AND b.page_no = p.page_no "
        "WHERE l.valid_to >= ? AND b.leaflet_id IS NULL AND p.page_no > 0 "
        "AND EXISTS (SELECT 1 FROM offers o WHERE o.leaflet_id = p.leaflet_id AND o.page_no = p.page_no) "
        "ORDER BY l.valid_from DESC, p.leaflet_id, p.page_no", (today,)).fetchall()
    done = 0
    leaflets: dict[str, Leaflet] = {}
    for lid, page_no, raw_json in rows:
        if done >= limit_pages:
            print(f"locate: budget of {limit_pages} pages reached, {len(rows) - done} left for the next run")
            break
        lf = leaflets.get(lid) or leaflets.setdefault(lid, dbm.row_to_leaflet(
            con.execute("SELECT * FROM leaflets WHERE id=?", (lid,)).fetchone()))
        url = dbm.page_image(con, lf, page_no)
        if not url:
            continue
        raws = json.loads(raw_json or "[]")
        products = []
        for i, d in enumerate(raws):
            if not d.get("name"):
                continue
            b = d.get("bbox")
            # Dino gives only a hotspot point (stored as a tiny box) – pass it as a hint.
            hint = (b[0], b[1]) if lf.store == "dino" and b and len(b) == 4 else None
            products.append({"id": i + 1, "name": d["name"], "price": d.get("price_text"), "hint": hint})
        if not products:
            continue
        img = _image_cache(lf, url)
        try:
            download(url, img)
            found = boxes.locate(img, products)
        except Exception as e:
            print(f"[{lf.store}] locate failed p{page_no}: {e}", file=sys.stderr)
            continue
        stored = {str(i - 1): {"name": raws[i - 1]["name"], "bbox": b} for i, b in found.items()}
        con.execute("INSERT OR REPLACE INTO page_boxes (leaflet_id, page_no, boxes_json, model) VALUES (?,?,?,?)",
                    (lid, page_no, json.dumps(stored, ensure_ascii=False), VISION_MODEL))
        con.commit()
        done += 1
    return done


def cmd_dates(con, limit_pages: int = VISION_MAX_PAGES_PER_RUN) -> int:
    """Read the date banners of every current page that has offers and no
    entry in page_dates yet. Returns the number of pages processed."""
    from .extract.page_dates import extract_dates
    from .extract.vision import VISION_MODEL

    offer_dates.ensure_schema(con)
    today = date.today().isoformat()
    rows = con.execute(
        "SELECT DISTINCT o.leaflet_id, o.page_no FROM offers o "
        "JOIN leaflets l ON l.id = o.leaflet_id "
        "LEFT JOIN page_dates d ON d.leaflet_id = o.leaflet_id AND d.page_no = o.page_no "
        "WHERE l.valid_to >= ? AND l.store IN ('biedronka','lidl','kaufland') AND d.leaflet_id IS NULL "
        "ORDER BY l.valid_from, o.leaflet_id, o.page_no", (today,)).fetchall()
    done = 0
    leaflets: dict[str, Leaflet] = {}
    for lid, page_no in rows:
        if done >= limit_pages:
            print(f"dates: budget of {limit_pages} pages reached, {len(rows) - done} left for the next run")
            break
        lf = leaflets.get(lid) or leaflets.setdefault(lid, dbm.row_to_leaflet(
            con.execute("SELECT * FROM leaflets WHERE id=?", (lid,)).fetchone()))
        url = dbm.page_image(con, lf, page_no)
        if not url:
            continue
        img = _image_cache(lf, url)
        try:
            download(url, img)
            regions = extract_dates(img)
        except Exception as e:
            print(f"[{lf.store}] dates failed p{page_no}: {e}", file=sys.stderr)
            continue
        con.execute("INSERT OR REPLACE INTO page_dates (leaflet_id, page_no, regions_json, model) VALUES (?,?,?,?)",
                    (lid, page_no, json.dumps(regions, ensure_ascii=False), VISION_MODEL))
        con.commit()
        done += 1
    return done


def _vision_pages(con, lf: Leaflet, rate: float, budget: int) -> tuple[int, int, bool]:
    """Run the vision model on every page not yet done. Returns (offers, used, complete)."""
    from .extract import vision

    total, used, complete = 0, 0, True
    # Pages already read, by stable key: the store may have reordered the list,
    # inserted ads or re-issued images under new URLs since then.
    done: dict[str, tuple[int, str]] = {}
    for pno, url in con.execute("SELECT page_no, image_url FROM pages WHERE leaflet_id=? AND page_no>0", (lf.id,)):
        key = dbm.page_key(url)
        if key:
            done[key] = (pno, url)
    used_nos = {r[0] for r in con.execute("SELECT page_no FROM pages WHERE leaflet_id=?", (lf.id,))}
    for idx, url in enumerate(lf.page_image_urls, start=1):
        if not url:
            continue
        key = dbm.page_key(url)
        if key in done:
            pno, old_url = done[key]
            if old_url != url:  # same page re-issued under a new URL – follow it, no new model call
                con.execute("UPDATE pages SET image_url=? WHERE leaflet_id=? AND page_no=?", (url, lf.id, pno))
            continue
        if budget - used <= 0:
            complete = False
            break
        # Keep the list position as page number when free, else append (a page was inserted).
        page_no = idx if idx not in used_nos else max(used_nos | {len(lf.page_image_urls)}) + 1
        png = _image_cache(lf, url)
        try:
            download(url, png)
            raws, _ = vision.extract_image(png)
        except Exception as e:
            print(f"[{lf.store}] vision failed p{idx}: {e}", file=sys.stderr)
            complete = False
            continue
        used += 1
        used_nos.add(page_no)
        done[key] = (page_no, url)
        total += len(_normalize_page(con, lf, page_no, raws, PageSource.vision, rate, image_url=url))
    return total, used, complete


def cmd_extract(con, use_vision: bool = False, limit_pages: int = VISION_MAX_PAGES_PER_RUN,
                text_layer_only: bool = False) -> None:
    rate = czk_per_pln(con)
    vision_budget = limit_pages
    for lf in dbm.leaflets_by_status(con, "fetched"):
        if not lf.is_food:
            dbm.set_status(con, lf.id, "extracted")
            continue
        total = 0
        if lf.store == "dino":
            for page_no, raws in structured.dino_offers(lf).items():
                total += len(_normalize_page(con, lf, page_no, raws, PageSource.structured, rate))
        elif lf.store in IMAGE_STORES:
            if lf.store == "lidl":  # structured non-food products come for free
                raws = structured.lidl_product_offers(lf)
                if raws:
                    total += len(_normalize_page(con, lf, 0, raws, PageSource.structured, rate))
            if text_layer_only and lf.store in ("lidl", "kaufland"):
                # Experimental: rule-based pairing on the PDF text layer. Weak on Lidl, empty on Kaufland.
                row = con.execute("SELECT pdf_path FROM leaflets WHERE id=?", (lf.id,)).fetchone()
                if row and row["pdf_path"] and Path(row["pdf_path"]).exists():
                    for page_no, raws in text_layer.extract_pdf(row["pdf_path"]).items():
                        total += len(_normalize_page(con, lf, page_no, raws, PageSource.text_layer, rate))
            elif use_vision:
                n, used, complete = _vision_pages(con, lf, rate, vision_budget)
                total += n
                vision_budget -= used
                if not complete:
                    print(f"[{lf.store}] {lf.title}: {total} offers so far, continues next run")
                    continue  # stays 'fetched' → resumed next run
            else:
                print(f"[{lf.store}] {lf.title}: {lf.pages} pages need --vision (skipped)")
                continue
        dbm.set_status(con, lf.id, "extracted")
        print(f"[{lf.store}] {lf.title}: {total} offers")


def cmd_score(con) -> int:
    today = date.today().isoformat()
    offers = dbm.all_offers(con, "valid_to>=?", (today,))
    assign_product_ids(con, offers)
    score_offers(con, offers)
    for o in offers:
        con.execute("UPDATE offers SET product_id=?, score=?, verdict=?, reason=? WHERE id=?",
                    (o.product_id, o.score, o.verdict, o.reason, o.id))
    return len(offers)


def cmd_verify(con) -> None:
    """Dry run on live sources without touching the DB: one leaflet per store."""
    for name, fn in SOURCES.items():
        try:
            found = fn()
        except Exception as e:
            print(f"[{name}] FAILED: {e}")
            continue
        food = [lf for lf in found if lf.is_food] or found
        if not food:
            print(f"[{name}] no leaflets")
            continue
        lf = food[0]
        print(f"\n[{name}] {lf.title} {lf.valid_from}→{lf.valid_to}, {lf.pages} pages, pdf={'yes' if lf.pdf_url else 'no'}, "
              f"structured products={len(lf.extra.get('products', []))}")
        if lf.store == "dino":
            pages = structured.dino_offers(lf)
            raws = [r for v in pages.values() for r in v]
        elif lf.pdf_url:
            dest = CACHE_DIR / "verify" / f"{name}.pdf"
            download(lf.pdf_url, dest)
            res = text_layer.extract_pdf(str(dest), pages=list(range(1, min(lf.pages, 6) + 1)))
            raws = [r for v in res.values() for r in v]
            print(f"  text layer on first {len(res)} pages → {len(raws)} offers; pages needing vision: {text_layer.pages_needing_vision(res)}")
        else:
            raws = []
            print(f"  image-only leaflet → {lf.pages} vision calls ≈ {lf.pages * 0.05:.1f} CZK")
        for r in raws[:5]:
            o = normalize(r, leaflet_id=lf.id, store=lf.store, page_no=1, valid_from=lf.valid_from, valid_to=lf.valid_to,
                          page_image_url=None, source=PageSource.structured, rate_czk_per_pln=5.8, idx=0)
            print("   ", json.dumps({"name": r.name, "price": r.price_text, "→": (o.price_pln, o.unit_price_pln, o.unit_price_unit, o.category) if o else None}, ensure_ascii=False))


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["discover", "fetch", "extract", "locate", "dates", "renormalize", "translate", "score",
                                       "build", "run", "verify"])
    ap.add_argument("--vision", action="store_true", help="use the vision model where needed")
    ap.add_argument("--stores", nargs="*", help="limit discovery to these stores")
    ap.add_argument("--pdf", action="store_true", help="also download Lidl/Kaufland PDFs to the cache")
    ap.add_argument("--text-layer", action="store_true", help="experimental: PDF text layer instead of vision")
    ap.add_argument("--max-pages", type=int, default=VISION_MAX_PAGES_PER_RUN, help="vision budget per run")
    a = ap.parse_args(argv)
    with dbm.connect() as con:
        if a.command == "verify":
            cmd_verify(con)
            return
        if a.command in ("discover", "run"):
            cmd_discover(con, a.stores)
        if a.command in ("fetch", "run"):
            cmd_fetch(con, a.pdf)
        if a.command in ("extract", "run"):
            cmd_extract(con, a.vision, a.max_pages, a.text_layer)
        if a.command == "locate" or (a.command == "run" and a.vision and LOCATE_MAX_PAGES_PER_RUN > 0):
            print(f"locate: {cmd_locate(con, LOCATE_MAX_PAGES_PER_RUN)} pages")
        if a.command == "dates" or (a.command == "run" and a.vision):
            print(f"dates: {cmd_dates(con, a.max_pages)} pages")
        if a.command in ("renormalize", "run"):
            print(f"renormalized {cmd_renormalize(con)} offers")
        if a.command == "translate":  # optional; the web shows the original Polish names
            from .translate import translate_names
            print(f"translated {translate_names(con)} names")
        if a.command in ("score", "run"):
            print(f"scored {cmd_score(con)} offers")
        if a.command in ("build", "run"):
            print("built", build(con, czk_per_pln(con)))


if __name__ == "__main__":
    main()
