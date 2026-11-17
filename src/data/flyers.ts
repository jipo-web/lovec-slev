import { StoreId } from '../types';

export interface FlyerPageData {
  pageNumber: number;
  title: string;
  theme: string;
  bannerNote: string;
  dealIds: string[];
}

export interface StoreFlyer {
  storeId: StoreId;
  flyerTitle: string;
  edition: string;
  validityRange: string;
  sourceUrl: string;
  pages: FlyerPageData[];
}

export const STORE_FLYERS: Record<StoreId, StoreFlyer> = {
  dino: {
    storeId: 'dino',
    flyerTitle: 'W Dino Najtaniej!',
    edition: 'Gazetka marketdino.pl · Čerstvé maso & rodinný nákup',
    validityRange: 'Platnost: Středa 28.10. – Úterý 05.11.',
    sourceUrl: 'https://marketdino.pl/gazetka/',
    pages: [
      {
        pageNumber: 1,
        title: 'Titulní strana: Řeznictví Agro-Rydzyna & Tradiční klobásy',
        theme: 'Maso a uzeniny z vlastních jatek',
        bannerNote: '💡 Dino nevyžaduje věrnostní kartu ani aplikaci! Všechny ceny platí přímo na váze a pokladně.',
        dealIds: ['dino-1', 'dino-2'],
      },
      {
        pageNumber: 2,
        title: 'Základní potraviny & Pečení',
        theme: 'Cukr, mouka, oleje ve výhodných baleních',
        bannerNote: '⚠️ Pozor na multi-buy: u cukru je podmínka nákupu min. 5 kg naráz.',
        dealIds: ['dino-3'],
      },
      {
        pageNumber: 3,
        title: 'Nápoje & Polské pivo',
        theme: 'Tyskie, Żywiec, Lech a minerálky',
        bannerNote: 'Čistá sleva bez omezení na plechovky i lahve.',
        dealIds: ['dino-4'],
      },
      {
        pageNumber: 4,
        title: 'Mléčné výrobky z polských farem',
        theme: 'Tvarohy Jana, másla a smetany',
        bannerNote: 'Tradiční polská kvalita bez přidaných aditiv za poloviční české ceny.',
        dealIds: ['dino-5'],
      },
    ],
  },
  biedronka: {
    storeId: 'biedronka',
    flyerTitle: 'Okazje Tygodnia & Festiwal Cen Biedronka',
    edition: 'Wydanie codzienne · Biedronka',
    validityRange: 'Platnost: Pondělí 26.10. – Středa 04.11.',
    sourceUrl: 'https://www.biedronka.pl/pl/gazetki',
    pages: [
      {
        pageNumber: 1,
        title: 'Hity z letáku: Máslo & Drůbeží maso',
        theme: 'Festiwal Masła & Świeżego Mięsa',
        bannerNote: '⚠️ OJEBOMETER: Maslo Mlekovita platí pouze při nákupu 3 ks s kartou Moja Biedronka!',
        dealIds: ['bie-1', 'bie-2'],
      },
      {
        pageNumber: 2,
        title: 'Káva & Ranní probuzení',
        theme: 'Zrnková a mletá káva světových značek',
        bannerNote: '🟢 Čistá sleva: Lavazza 1kg za bezkonkurenčních cca 292 Kč (v ČR běžně 449 Kč).',
        dealIds: ['bie-3'],
      },
      {
        pageNumber: 3,
        title: 'Mléčné produkty & Mega kartony',
        theme: 'Kartonová balení UHT mléka a jogurtů',
        bannerNote: '⚠️ Podmínka nákupu celého kartonu (12 l) pro získání akční ceny 1,99 PLN.',
        dealIds: ['bie-4'],
      },
      {
        pageNumber: 4,
        title: 'Drogerie & Dětský svět',
        theme: 'Pampers, Persil, Silan a čistící prostředky',
        bannerNote: '🟡 Druhý kus -50 % na plenky Pampers při nákupu 2 balení.',
        dealIds: ['bie-5'],
      },
    ],
  },
  lidl: {
    storeId: 'lidl',
    flyerTitle: 'Lidl Od Poniedziałku – Więcej na radość z życia',
    edition: 'Tydzień wielkich marek i XXL',
    validityRange: 'Platnost: Pondělí 29.10. – Neděle 04.11.',
    sourceUrl: 'https://www.lidl.pl/gazetki',
    pages: [
      {
        pageNumber: 1,
        title: 'XXL Balení & Vepřové maso',
        theme: 'Ser Gouda 500g & Schab bez kości',
        bannerNote: '📱 POZOR: V polském Lidlu musíte v aplikaci Lidl Plus předem kliknout na "Aktywuj kupon"!',
        dealIds: ['lidl-1', 'lidl-3'],
      },
      {
        pageNumber: 2,
        title: 'Velké praní & Drogerie',
        theme: 'Ariel Pods 60 ks za super cenu',
        bannerNote: '🟢 Žádná podmínka ani aplikace, skvělá cena pro každého.',
        dealIds: ['lidl-2'],
      },
      {
        pageNumber: 3,
        title: 'Sladkosti & Čokolády Fin Carré',
        theme: 'Sladká nabídka 2+1 zdarma',
        bannerNote: '⚠️ Sleva se projeví až při vložení 3 tabulek čokolády do košíku.',
        dealIds: ['lidl-4'],
      },
      {
        pageNumber: 4,
        title: 'Pekařství & Chléb z pece',
        theme: 'Čerstvě upečeno po celý den',
        bannerNote: 'Akce na bagety a polský venkovský chléb.',
        dealIds: [],
      },
    ],
  },
  kaufland: {
    storeId: 'kaufland',
    flyerTitle: 'Kaufland Więcej Oszczędności',
    edition: 'Wydanie regionalne Dolny Śląsk / Śląsk',
    validityRange: 'Platnost: Čtvrtek 29.10. – Středa 04.11.',
    sourceUrl: 'https://www.kaufland.pl/gazetka',
    pages: [
      {
        pageNumber: 1,
        title: 'XXL Praní: Vizir 100 praní',
        theme: 'Rodinná balení pracích prášků',
        bannerNote: '🟢 Čistá sleva – ušetříte přes 200 Kč oproti nákupu v českém Kauflandu.',
        dealIds: ['kauf-1'],
      },
      {
        pageNumber: 2,
        title: 'Čerstvá drůbež z pultu',
        theme: 'Kuřecí prsní mini řízky',
        bannerNote: '🟡 Nutná Kaufland Card PL. Česká kartička v Polsku nefunguje!',
        dealIds: ['kauf-2'],
      },
      {
        pageNumber: 3,
        title: 'Polské mlékárenské speciality',
        theme: 'Piątnica, Mlekpol a Łowicz',
        bannerNote: 'Oblíbený polský cottage serek wiejski při nákupu 3 ks.',
        dealIds: ['kauf-3'],
      },
      {
        pageNumber: 4,
        title: 'Péče o domácnost & Čistota',
        theme: 'Jar, Lenor, Domestos',
        bannerNote: 'Sledujte limity na kartu u aviváží a gelů.',
        dealIds: [],
      },
    ],
  },
};
