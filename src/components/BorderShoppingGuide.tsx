import React from 'react';
import { CreditCard, Smartphone, Store, Calendar, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';

export const BorderShoppingGuide: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 text-white shadow-md">
        <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-bold block mb-2">
          Příručka pro české nakupující v Polsku
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Jak v Polsku ušetřit maximum a nenaletět na slevové chytáky
        </h2>
        <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
          Nákupy v polských obchodech Biedronka, Dino, Lidl či Kaufland jsou pro Čechy mimořádně výhodné. Přesto existuje několik pastí, na kterých můžete nevědomky prodělat stovky korun.
        </p>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tip 1: DCC Currency Conversion Trap */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold uppercase">
                Největší bankovní past
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                DCC trik na platebním terminálu
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Když přiložíte českou platební kartu k terminálu, obrazovka vám často nabídne: <em>"Zaplatit v CZK s garantovaným kurzem"</em> nebo <em>"Zaplatit v PLN"</em>.
          </p>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 font-medium">
            ⚠️ <strong>Zásadní pravidlo:</strong> VŽDY na terminálu zmáčkněte <strong>PLN (zloté)</strong>! Pokud zvolíte CZK, polská banka vám naúčtuje kurz s marží 8 až 12 %, což může nákup za 2 000 Kč prodražit o 200 Kč.
          </div>
        </div>

        {/* Tip 2: The Dino Supermarket Advantage */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                marketdino.pl
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Proč je řetězec Dino tak oblíbený
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Řetězec <strong>Dino Polska</strong> má více než 2 400 prodejen po celé zemi a hojně roste v příhraničních obcích. Pro Čechy má obrovskou výhodu:
          </p>
          <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <li>✅ <strong>Žádná aplikace ani karta:</strong> Slevy platí pro všechny zákazníky bez registrace.</li>
            <li>✅ <strong>Vlastní masny Agro-Rydzyna:</strong> Čerstvé pultové maso, klobásy, šunky a uzeniny za zlomkové ceny.</li>
            <li>✅ <strong>Klidnější nákup:</strong> Menší prodejny bez davů na rozdíl od příhraničních Biedronek.</li>
          </ul>
        </div>

        {/* Tip 3: How to get Polish Apps from Czech phone */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold uppercase">
                Věrnostní aplikace
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Jak nainstalovat Moja Biedronka & Lidl Plus
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Spousta slev v Biedronce a Lidlu vyžaduje aplikaci. Zde je postup:
          </p>
          <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <li>📱 <strong>Lidl Plus:</strong> Stačí otevřít běžnou českou aplikaci Lidl Plus, jít do <em>Více → Změnit zemi</em> a vybrat <strong>Polsko</strong>.</li>
            <li>🐞 <strong>Moja Biedronka:</strong> Aplikaci lze stáhnout z Google Play / App Store (nebo si u pokladny vzít plastovou kartičku a zaregistrovat ji s českým telefonním číslem s předvolbou +420).</li>
            <li>⚡ <strong>Aktivace kuponů:</strong> V polském Lidlu musíte v aplikaci před nákupem kliknout na <em>"Aktywuj kupon"</em>!</li>
          </ul>
        </div>

        {/* Tip 4: Sunday Trading Ban (Niedziele Handlowe) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold uppercase">
                Otevírací doba
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nedělní zákaz prodeje v Polsku
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            V Polsku platí přísný zákon zakazující maloobchodní prodej v neděli (tzv. <em>Niedziela niehandlowa</em>). Supermarkety Biedronka, Dino, Lidl a Kaufland mají v běžné neděle <strong>zavřeno</strong>.
          </p>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
            Výjimkou je pouze cca 7 "obchodních nedělí" (Niedziele handlowe) v roce – typicky před Vánocemi, Velikonocemi a na konci srpna. Otevřeny v neděli smějí být pouze čerpací stanice a malé rodinné obchody Žabka.
          </div>
        </div>
      </div>

      {/* Cross-border Limits strip */}
      <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Dovozní limity pro osobní spotřebu v rámci EU (Polsko → Česko):</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          Při běžném nákupu potravin (maso, mléko, máslo, sýry, pečivo) neexistuje žádný finanční ani váhový limit pro osobní spotřebu. U zboží podléhajícího spotřební dani platí orientační limity Celní správy ČR:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block">Pivo:</span>
            <strong className="text-slate-800 dark:text-white">až 110 litrů</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block">Víno:</span>
            <strong className="text-slate-800 dark:text-white">až 90 litrů</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block">Lihoviny:</span>
            <strong className="text-slate-800 dark:text-white">až 10 litrů</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block">Cigarety:</span>
            <strong className="text-slate-800 dark:text-white">až 800 kusů</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
