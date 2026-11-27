"""Fallback leaflet source for Kaufland (gazetkipromocyjne.net)."""
import html
import json
from datetime import date

from pipeline.models import Leaflet
from pipeline.sources import gazetkipromocyjne as gp
from pipeline.sources.kaufland import FOOD_TITLES, merge_sources


def _card(gp_id: int, label: str, key: str, pages: int) -> str:
    items = []
    for i in range(1, pages + 1):
        items.append({"w": 908, "h": 1280, "src": f"/wp-content/uploads/pdf/cache/{key}/{i}.jpg"})
        if i == 1:
            items.append({"html": '<div class="gp-reader-ad">ad</div>'})
    attr = html.escape(json.dumps(items), quote=True)
    return (f'<div class="newspapper gp-leaflet-card" data-age-restricted="0" data-items="{attr}">'
            f'<button type="button" rel="#id{gp_id}" data-token="x"\n aria-label="{label}"\n class="gp-leaflet-trigger">'
            f'</button><div id="id{gp_id}" class="newspapper-preview"><a download="x.pdf" '
            f'href="https://www.gazetkipromocyjne.net/wp-content/uploads/pdf/{key}.pdf">Pobierz</a></div></div>')


PAGE = "".join([
    _card(117465, "Przeglądaj gazetkę Kaufland, 26/11/2026 – 02/12/2026, Kaufland Gazetka Tygodnia", "0__aaa", 3),
    _card(117457, "Przeglądaj gazetkę Kaufland, 26/11/2026 – 02/12/2026, Cudowne Świąteczne Dekoracje", "0__bbb", 2),
    _card(117324, "Przeglądaj gazetkę Kaufland, 23/11/2026 – 25/11/2026, Oferta zakończona, Mocny Start", "0__ccc", 2),
])


def test_parses_current_leaflets_with_pages_pdf_and_food_flag():
    found = gp.parse_store_page(PAGE, "kaufland", "kaufland", FOOD_TITLES)
    assert [lf.id for lf in found] == ["kaufland:gp-117465", "kaufland:gp-117457"]  # ended one skipped
    weekly = found[0]
    assert (weekly.valid_from, weekly.valid_to) == (date(2026, 11, 26), date(2026, 12, 2))
    assert weekly.title == "Kaufland Gazetka Tygodnia" and weekly.is_food
    assert weekly.pages == 3  # the ad slot is not a page
    assert weekly.page_image_urls[0] == "https://www.gazetkipromocyjne.net/wp-content/uploads/pdf/cache/0__aaa/1.jpg"
    assert weekly.pdf_url.endswith("/pdf/0__aaa.pdf")
    assert not found[1].is_food


def test_mirror_does_not_duplicate_an_official_leaflet():
    mirror = gp.parse_store_page(PAGE, "kaufland", "kaufland", FOOD_TITLES)
    official = Leaflet(id="kaufland:uuid", store="kaufland", title="Kaufland 26.11.2026 - 02.12.2026",
                       valid_from=date(2026, 11, 26), valid_to=date(2026, 12, 2), source_url="x")
    merged = merge_sources([official], mirror)
    assert [lf.id for lf in merged] == ["kaufland:uuid", "kaufland:gp-117457"]
    assert len(merge_sources([], mirror)) == 2
