"""Command line: python -m pipeline <command>

  discover            find current leaflets in all sources, store new ones
  fetch               download PDFs (Lidl/Kaufland/Dino); Biedronka/Dino images are used by URL
  extract [--vision]  structured + text-layer extraction; --vision also runs the model on
                      Biedronka pages and on PDF pages where the text layer found nothing
  score               product matching + scoring for offers valid today or later
  build               write public/data/*.json
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
from .build import build
from .config import CACHE_DIR, VISION_MAX_PAGES_PER_RUN
from .extract import structured, text_layer
from .http import download
from .match import assign_product_ids
from .models import Leaflet, Offer, PageSource, RawOffer
from .normalize import normalize
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


def _normalize_page(con, lf: Leaflet, page_no: int, raws: list[RawOffer], source: PageSource, rate: float) -> list[Offer]:
    img = lf.page_image_urls[page_no - 1] if 0 < page_no <= len(lf.page_image_urls) else None
    offers = []
    for i, r in enumerate(raws):
        o = normalize(r, leaflet_id=lf.id, store=lf.store, page_no=page_no, valid_from=lf.valid_from,
                      valid_to=lf.valid_to, page_image_url=img, source=source, rate_czk_per_pln=rate, idx=i)
        if o:
            offers.append(o)
    dbm.save_page(con, lf.id, page_no, source.value, [r.model_dump() for r in raws], needs_review=not offers)
    dbm.replace_offers(con, lf.id, page_no, offers)
    return offers


IMAGE_STORES = ("biedronka", "lidl", "kaufland")  # page images from the store API → vision model


def _vision_pages(con, lf: Leaflet, rate: float, budget: int) -> tuple[int, int, bool]:
    """Run the vision model on every page not yet done. Returns (offers, used, complete)."""
    from .extract import vision

    total, used, complete = 0, 0, True
    for page_no, url in enumerate(lf.page_image_urls, start=1):
        if not url or dbm.page_done(con, lf.id, page_no):
            continue
        if budget - used <= 0:
            complete = False
            break
        png = CACHE_DIR / lf.store / f"{lf.id.split(':')[1]}-{page_no:03d}.jpg"
        try:
            download(url, png)
            raws, _ = vision.extract_image(png)
        except Exception as e:
            print(f"[{lf.store}] vision failed p{page_no}: {e}", file=sys.stderr)
            complete = False
            continue
        used += 1
        total += len(_normalize_page(con, lf, page_no, raws, PageSource.vision, rate))
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
    ap.add_argument("command", choices=["discover", "fetch", "extract", "score", "build", "run", "verify"])
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
        if a.command in ("score", "run"):
            print(f"scored {cmd_score(con)} offers")
        if a.command in ("build", "run"):
            print("built", build(con, czk_per_pln(con)))


if __name__ == "__main__":
    main()
