# Lovec slev

Přehled slev z polských letáků (Biedronka, Dino, Lidl.pl, Kaufland.pl) pro nakupující
z česko-polského příhraničí. Denní pipeline stáhne letáky, vytáhne produkty a ceny,
ohodnotí výhodnost a vygeneruje statický web.

```
pipeline/   Python – discover → fetch → extract → score → build (JSON)
src/        React 19 + Vite + Tailwind – web, čte public/data/*.json
data/       lovec.db (SQLite, cenová historie – v gitu jen ve větvi `data`), cache/
public/data offers-latest.json, leaflets.json, group-promos.json – výstup pipeline pro web (necommituje se)
```

## Zdroje letáků (ověřeno 16. 11. 2026)

| Řetězec | Jak | Produkty |
| --- | --- | --- |
| Dino | `marketdino.pl/gazetki/lista/standard/_payload.json` – Nuxt payload s PDF, obrázky stránek a hotspoty (název, EAN, cena, pozice) | **strukturovaně, bez modelu** |
| Lidl.pl | ESI přehled `esi.leaflets.schwarz/overview?client_locale=lidl/pl-PL` → `endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=…` (platnost, PDF, obrázky stránek 1200 px) | vision model na obrázcích stránek; non-food produkty z API |
| Kaufland.pl | stejné API s `client_locale=kaufland/pl-PL&region_id=…` (web kaufland.pl blokuje datacentra, API ne); od 26. 11. 2026 je celostátní přehled prázdný, proto záloha [gazetkipromocyjne.net/kaufland](https://www.gazetkipromocyjne.net/kaufland/) (obrázky 908 px + PDF) | vision model |
| Biedronka | `biedronka.pl/pl/gazetki` → stránka letáku → `galleryLeaflet.init("<uuid>")` → `leaflet-api.prod.biedronka.cloud/api/leaflets/<uuid>?ctx=web` (jen obrázky stránek; platnost „od“ ze slugu, „do“ odhad podle cyklu) | vision model |

PDF textová vrstva (Lidl/Kaufland) byla vyzkoušena a je nepoužitelná – ceny najde, názvy ne
(`--text-layer` zůstává jako experiment).

## Spuštění

```bash
pip install -r requirements.txt
export VISION_API_KEY=sk-or-...          # OpenRouter (nebo jiný OpenAI-kompatibilní endpoint)
export VISION_MODEL=google/gemini-2.5-flash

python -m pipeline verify                # suchý test všech zdrojů, nic neukládá
python -m pipeline run                   # bez modelu: Dino + Lidl non-food
python -m pipeline run --vision          # + Biedronka, Lidl, Kaufland přes vision model
python -m pipeline run --vision --max-pages 50   # rozpočet stránek na jeden běh

npm install && npm run dev               # web čte public/data/*.json; bez nich ukázková data
python -m pytest -q
```

Rozpočet: první běh ~450 stránek, dál ~250–300 stránek týdně ≈ 15–30 Kč/měsíc s Gemini Flash.
Nedokončený leták (vyčerpaný rozpočet, chyba sítě) zůstane ve stavu `fetched` a dojede příští den.

### Obrázky zboží
Průchod `locate` vrací dva rámečky: celou dlaždici (cenovka, text) a jen fotku produktu.
Krok `crops` z nich vyřízne WebP (max. 520 px, ~15 kB) z nejostřejší verze stránky
(Lidl/Kaufland „zoom“ 2400 px) do `data/media/` a `build` zkopíruje použité do `public/media/`.
Karta ukazuje fotku zboží, detail nabídky dlaždici tak, jak je v letáku. Bez fotky se vyřízne
dlaždice; bez souboru web ořízne stránku v prohlížeči jako dřív. Ve workflow drží `data/media`
mezi běhy cache, takže se řežou jen nové nabídky.

## Hodnocení

`score` = 50 % sleva vs. medián ceny téhož produktu za 8 týdnů (všechny řetězce)
+ 30 % srovnání s nejnižší aktuální cenou jinde + 20 % percentil jednotkové ceny v kategorii.
Chybějící signály předají váhu ostatním; bez historie se bere jen deklarovaná sleva (slabý signál).
Verdikty: `trhak` ≥ 0,35 · `dobra_koupe` ≥ 0,15 · `nic_moc` ≥ 0 · `past` < 0.
Produkty se párují přes EAN, normalizovaný název+značka+gramáž a fuzzy match (rapidfuzz ≥ 92).

## Nasazení

`.github/workflows/daily.yml` běží denně v 6:41 (a ručně přes Actions → Daily leaflets → Run workflow):

1. obnoví databázi z větve `data`, spustí pipeline a databázi uloží zpět do větve `data`
   jako jediný commit bez historie (repozitář tak neroste); posledních 30 databází zůstává
   navíc jako artefakty běhu,
2. podle proměnné `DEPLOY_TARGET` nasadí web na GitHub Pages, na vlastní webhosting přes FTP,
   nebo na obojí.

Vše se nastavuje v repozitáři: **Settings → Secrets and variables → Actions**.

| Kde | Název | Hodnota | Povinné |
| --- | --- | --- | --- |
| Secret | `OPENROUTER_API_KEY` | klíč pro vision model | ano |
| Variable | `DEPLOY_TARGET` | `pages` (výchozí), `ftp`, `both` | ne |
| Variable | `VISION_MODEL`, `VISION_BASE_URL`, `VISION_MAX_PAGES_PER_RUN` | viz výše | ne |
| Variable | `LIDL_REGION_CODE`, `KAUFLAND_REGION_CODE` | kód regionu, výchozí `0` | ne |

### A) GitHub Pages (zdarma, repozitář musí být veřejný)

- Settings → Pages → Source: **GitHub Actions**.
- Web běží na `https://<uživatel>.github.io/<repo>/`.
- Vlastní doména: Settings → Pages → Custom domain, u registrátora `CNAME www → <uživatel>.github.io`
  (pro holou doménu A záznamy 185.199.108.153, .109.153, .110.153, .111.153), zapnout „Enforce HTTPS“
  a nastavit variable `PAGES_BASE` = `/`.

### B) Vlastní webhosting přes FTP (repozitář může být soukromý)

- Variable `DEPLOY_TARGET` = `ftp` (nebo `both`).
- Secrets `FTP_SERVER` (např. `xxxxx.wedos.net`), `FTP_USERNAME`, `FTP_PASSWORD` – údaje
  najdete v administraci hostingu.
- Volitelné variables: `FTP_SERVER_DIR` (výchozí `./www/` – kořen webu, u Wedosu obvykle `www/`;
  u jiných hostingů často `./public_html/` nebo `./`), `FTP_PROTOCOL` (`ftps` výchozí, `ftp`,
  `ftps-legacy`), `FTP_PORT` (21), `FTP_BASE` (výchozí `/`, jinak cesta podsložky, např. `/slevy/`).
- Nahrávají se jen změněné soubory (stav si akce drží v `.ftp-deploy-sync-state.json` na serveru).
- Doména se nastavuje u hostingu, workflow s ní nic nedělá.

Na hostingu stačí obyčejný statický web – žádné PHP, databáze ani Python. Pipeline vždy běží
v GitHub Actions; soukromý repozitář má v tarifu GitHub Free omezený měsíční počet minut Actions,
denní běh se do něj vejde.

## Co chybí

- region: `region_code=0` je celostátní vydání; pro Zebrzydowice / Jastrzębie-Zdrój dohledat
  `region_id`/`store_id` z `esi.leaflets.schwarz` (parametr `data-query` na stránce prodejny)
- Biedronka: varianty prodejen („z ladą tradycyjną“ = slug s `-p-`) a konec platnosti jsou odhad
- české srovnávací ceny (Kupi.cz) – pole `czechEquivalentCzk` je zatím 0 a web ho skrývá
- notifikace, PWA

## Gemini API zdarma (Google AI Studio)

Modul `vision.py` mluví s libovolným OpenAI-kompatibilním endpointem, takže místo OpenRouteru jde použít
free tier Gemini API (klíč z aistudio.google.com):

```bash
export VISION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
export VISION_API_KEY=AIza...
export VISION_MODEL=gemini-2.5-flash        # nebo gemini-2.5-flash-lite (vyšší denní limit)
python -m pipeline run --vision --max-pages 200
```

Limity free tieru jsou per projekt a Google je mění – skutečná čísla jsou v AI Studiu (Rate limits).
Při 429 modul počká a zkusí znovu; po vyčerpání denního limitu leták zůstane ve stavu `fetched`
a dojede příští den. `--max-pages` nastavte pod denní limit požadavků.
V GitHub Actions stačí secret `OPENROUTER_API_KEY` nahradit Gemini klíčem a přidat variables
`VISION_BASE_URL` a `VISION_MODEL`.
