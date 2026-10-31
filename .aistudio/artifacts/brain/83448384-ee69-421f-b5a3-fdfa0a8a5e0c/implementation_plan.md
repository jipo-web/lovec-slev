# Polské Letáky & Hlídač Chytáků (LovciSlev PL / Ojeb.cz PL)

Aplikace pro české nakupující v polských supermarketech (**Biedronka**, **Lidl.pl**, **Kaufland.pl**, **Carrefour** a nově **Dino / marketdino.pl**), která přehledně zobrazuje aktuální akční letáky, odhaluje slevové chytáky (podmínky věrnostních karet, nákup více kusů, denní limity, podmíněné kupony), automaticky přepočítává ceny z PLN na CZK a počítá reálnou úsporu vůči cenám v ČR v chytrém nákupním seznamu.

### User Review & Critical Decisions

> [!IMPORTANT]
> Plán byl upraven podle vašeho přání a zahrnuje 5 klíčových polských maloobchodních řetězců:

- **Zahrnuté řetězce**:
  1. **Biedronka** (karta Moja Biedronka, limity a multi-buy pravidla)
  2. **Lidl Polska** (aplikace Lidl Plus PL s aktivací kuponů)
  3. **Kaufland Polska** (Kaufland Card PL a velká rodinná balení)
  4. **Carrefour Polska** (aplikace Mój Carrefour a e-kupony na další nákup)
  5. **Dino Polska (marketdino.pl)** (tradiční polský řetězec s vlastními masnými výrobky Agro-Rydzyna, časté akce 2+1 a balíčkové slevy)
- **Klíčové funkce**:
  - Dynamický přepočet PLN na CZK s nastavitelným kurzem (výchozí 5,85 Kč/PLN).
  - Přímé srovnání s běžnou cenou v ČR a kalkulace úspory v Kč i %.
  - Zvýraznění podmínek akcí: povinnost aplikace / karty, limity kusů na nákup, multi-buy pravidla (2+1, 2. kus -50 %).
  - Interaktivní nákupní seznam s celkovým součtem v PLN a CZK, celkovou úsporou a upozorněním na potřebné věrnostní karty pro nákupní cestu.
  - Možnost přepnutí mezi zobrazením produktových karet a vizuálním náhledem stránek letáku jednotlivých řetězců.

---

### 1. Overview & Core Concept

- **Co aplikace dělá**: Poskytuje českým zákazníkům jezdícím nakupovat do Polska kompletní, transparentní nástroj na prozkoumání slev bez marketingových pastí. U každé položky ukáže konečnou cenu za měrnou jednotku (kg/ks/l), porovná ji s českou cenovou hladinou a jasně varuje před podmínkami, bez nichž sleva neplatí.
- **Cílová skupina**: Čeští spotřebitelé a rodiny nakupující v polském příhraničí, kteří chtějí ušetřit, ale nechtějí naletět na komplikované slevové mechanismy polských řetězců.
- **Klíčová hodnota**: Eliminace nepříjemných překvapení u polské pokladny, rychlá kalkulace výhodnosti v českých korunách a organizovaný nákupní plán.

---

### 2. User Experience & Visual Design

- **Hlavní uživatelské toky**:
  1. *Filtrování a průzkum*: Uživatel zvolí řetězec (**Biedronka**, **Lidl**, **Kaufland**, **Carrefour**, **Dino**) a kategorii (Maso a uzeniny, Mléčné výrobky, Trvanlivé, Drogerie, Nápoje).
  2. *Analýza chytáků & Srovnání*: Uživatel vidí karty produktů s cenou v PLN i CZK, úsporou oproti ČR (např. *-45 % vs ČR*) a odznakem transparentnosti:
     - 🟢 **Čistá sleva**: Platí pro každého bez podmínek.
     - 🟡 **Podmíněná karta/aplikace**: Vyžaduje Moja Biedronka / Lidl Plus PL / Kaufland Card / Mój Carrefour.
     - 🔴 **Pozor na chyták**: "2+1 zdarma" (cena platí jen při koupi 3 ks), limit 2 kg na kartu za den, cashback na další nákup místo přímé slevy apod.
  3. *Náhled stránek letáku*: Uživatel může jedním kliknutím otevřít vizuální listování letákem daného řetězce včetně letáku Dino z *marketdino.pl*.
  4. *Nákupní seznam & Příhraniční kalkulačka*: Přidávání položek do nákupního košíku, úprava počtu kusů, zobrazení souhrnu (Celkem PLN, Celkem CZK, Celková úspora vs. ČR v Kč) a seznamu vyžadovaných věrnostních aplikací k instalaci do telefonu.

- **Vizuální identita a estetika**:
  - *Styl*: Čistý, funkční maloobchodní watchdog v duchu moderních evropských srovnávačů cen. Žádný laciný křiklavý bulvár, ale kultivovaná typografie a vysoká čitelnost.
  - *Barevná paleta*: 
    - Pozadí: Neutrální čisté plátno (`bg-slate-50 dark:bg-slate-950`).
    - Karty a povrchy: `bg-white dark:bg-slate-900` s jemným orámováním `border-slate-200 dark:border-slate-800`.
    - Značkové akcenty: Biedronka (žlutá/červená), Lidl (modrá/žlutá), Kaufland (červená), Carrefour (kobaltová modř), **Dino** (červeno-zelený motiv Dino).
    - Statusy chytáků: Smaragdová (`emerald-600`), jantarová (`amber-600`), terakotově červená (`rose-600`).
  - *Typografie*: Nadpisy v `Outfit` / `Plus Jakarta Sans`, data a ceny v přesném `font-mono tabular-nums`.

- **Interaktivní detaily**:
  - Okamžitý přepočet cen při změně kurzu PLN/CZK v záhlaví.
  - Detailní modální okno s rozpadem triku u daného produktu (např. *"Proč je to chyták? Cena 14,99 PLN platí pouze při nákupu 2 balení a naskenování karty. Jedno balení stojí plných 24,99 PLN"*).
  - Možnost vygenerovat a zkopírovat nákupní lístek do schránky (pro SMS / WhatsApp).

---

### 3. Key Product Decisions & Trade-Offs

- **Rozhodnutí 1: Bohatá databáze reálných akcí 5 klíčových polských řetězců**
  - *Zvolený přístup*: Detailně strukturovaná databáze hitů (Biedronka, Lidl, Kaufland, Carrefour, Dino) napříč typickými kategoriemi pro české nákupy (vepřové a drůbeží maso Agro-Rydzyna u Dina, máslo Mlekovita, káva Lavazza, prací kapsle Ariel/Persil, polské sýry, pivo, sladkosti), včetně přesných podmínek, platnosti a porovnávacích cen v ČR.
  - *Důvod*: Uživatel má okamžitě k dispozici funkční, věrohodná a užitečná data bez zdlouhavého načítání.

- **Rozhodnutí 2: Správa nákupního seznamu a kurzu v LocalStorage**
  - *Zvolený přístup*: Plná perzistence nákupního seznamu, vlastních položek a uživatelského kurzu v `localStorage`.
  - *Důvod*: Rychlé načítání bez prodlev, funkčnost offline na cestách v autě či v obchodě bez nutnosti přihlašování.

- **Rozhodnutí 3: Vizuální prohlížeč stránek letáku**
  - *Zvolený přístup*: Integrovaný režim "Listování letákem" (Flyer View), který simuluje stránky tištěného letáku s interaktivními body (hotspots) prokliknutelnými přímo do nákupního seznamu.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Navigation & Top Bar                        │
│  [Logo / Brand] ── [Letáky | Všechny Akce | Seznam] ── [Kurz PLN: 5.85]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌───────────────────────────────┐        ┌──────────────────────────────┐
│  Store & Category Filters     │        │  Shopping List Drawer        │
│  • Biedronka / Lidl / Kaufland│        │  • Položky s počtem kusů     │
│  • Carrefour / Dino           │        │  • Součet v PLN & CZK        │
│  • Typ chytáku (Vše/Čisté/Pozor)       │  • Celková úspora vs ČR (Kč) │
│  • Kategorie (Maso/Mléko/Drogerie)     │  • Upozornění na karty/appky │
└──────────────┬────────────────┘        │  • Kopírování do schránky    │
               │                         └──────────────▲───────────────┘
       ┌───────┴────────────────┐                       │ Add/Remove
       ▼                        ▼                       │
┌─────────────────────────┐  ┌──────────────────────────┴───────────────┐
│  Product Cards Grid     │  │  Interactive Flyer Viewer Mode           │
│  • Ceny v PLN + CZK     │  │  • Stránky letáku (Dino, Lidl, Biedronka)│
│  • Odznaky "Ojebometru" │  │  • Interaktivní klikací nabídky          │
│  • Podmínky & limit ks  │  │  • Zobrazení platnosti letáku            │
│  • Srovnání s ČR        │  └──────────────────────────────────────────┘
└─────────────────────────┘
```

- **Datový model položky akce (`FlyerDeal`)**:
  - `id`: unikátní identifikátor
  - `store`: `'biedronka' | 'lidl' | 'kaufland' | 'carrefour' | 'dino'`
  - `title`: Název produktu (např. *"Kiełbasa Śląska Agro-Rydzyna 500g"*, *"Máslo Mlekovita 200g"*)
  - `category`: Kategorie
  - `promoPricePln`: Akční cena v PLN
  - `regularPricePln`: Běžná cena v PLN
  - `czechEquivalentCzk`: Typická srovnávací cena v českých obchodech
  - `unit`: Např. `ks`, `kg`, `100g`, `balení`
  - `trickType`: `'clean' | 'conditional_card' | 'trick_warning'`
  - `trickTitle`: Stručný popis podmínky
  - `trickExplanation`: Detailní vysvětlení, na co si dát pozor
  - `requiredCard`: `'Moja Biedronka' | 'Lidl Plus' | 'Kaufland Card' | 'Mój Carrefour' | null`
  - `maxLimit`: Např. *"Max 3 ks na nákup"*
  - `validUntil`: Datum platnosti letáku
  - `flyerPage`: Číslo stránky v letáku
