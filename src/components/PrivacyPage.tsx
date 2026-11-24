import React from 'react';
import { ShieldCheck } from 'lucide-react';

/** Who runs the site and how to reach them – shown on the privacy page. */
export const OPERATOR = {
  name: 'Provozovatel webu Lovec-slev.cz',
  email: '',
};

/** Date of the last change of this text (shown on the page). */
const UPDATED = '24. 11. 2026';

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-base font-bold text-slate-900 dark:text-white pt-2">{children}</h2>
);

export const PrivacyPage: React.FC = () => (
  <article className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
    <header className="space-y-1">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="w-5 h-5" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wider">Soukromí</span>
      </div>
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Soukromí a ochrana údajů</h1>
      <p className="text-xs text-slate-600 dark:text-slate-400">Aktualizováno {UPDATED}</p>
    </header>

    <p>
      Lovec-slev.cz je nezávislý přehled akčních letáků polských obchodů. <strong>Nemá uživatelské účty</strong>, nepoužívá
      analytiku, reklamu ani sledovací cookies a o návštěvnících sám nic neukládá.
    </p>

    <H2>Co se ukládá ve vašem prohlížeči</H2>
    <p>
      Aby web fungoval, ukládá si do úložiště vašeho prohlížeče (<em>localStorage</em>):
    </p>
    <ul className="list-disc pl-5 space-y-1">
      <li>nákupní lístek a vlastní položky,</li>
      <li>kurz koruny, pokud jste ho ručně změnili,</li>
      <li>volbu světlého nebo tmavého vzhledu.</li>
    </ul>
    <p>
      Tyto údaje zůstávají jen ve vašem zařízení a nikam se neodesílají. Položky lístku, jejichž akce skončila, web sám
      odebere. Vše smažete tlačítkem „Vymazat vše“ v nákupním lístku nebo smazáním dat webu v nastavení prohlížeče. Protože
      jde o funkci, kterou sami používáte, nepotřebuje souhlas ani cookie lištu.
    </p>

    <H2>Sdílení nákupního lístku</H2>
    <p>
      Tlačítka Kopírovat, Google Keep, WhatsApp, SMS a Sdílet předají text lístku jen té aplikaci nebo službě, kterou sami
      zvolíte. Web ho nikam jinam neposílá. Další zpracování se řídí podmínkami zvolené služby.
    </p>

    <H2>Hosting a technické údaje</H2>
    <p>
      Web běží na službě <strong>GitHub Pages</strong> (GitHub, Inc., USA). Při každém načtení stránky prohlížeč posílá
      serveru technické údaje, hlavně <strong>IP adresu</strong> a typ prohlížeče. GitHub je zpracovává kvůli doručení
      stránky a zabezpečení podle svých{' '}
      <a
        href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        zásad ochrany osobních údajů
      </a>
      . Provozovatel webu k těmto záznamům přístup nemá a nepoužívá je.
    </p>
    <p>Písmo, data a výřezy zboží se načítají přímo z tohoto webu, ne od třetích stran.</p>

    <H2>Obsah z jiných webů</H2>
    <p>
      Stránky letáků (v sekci Letáky, v detailu nabídky a u zboží, ke kterému nemáme vlastní výřez) se načítají přímo ze
      serverů obchodů: Lidl a Kaufland
      (leaflets.schwarz), Biedronka (biedronka.cloud) a Dino (marketdino.pl). Váš prohlížeč jim přitom předá IP adresu,
      stejně jako při návštěvě jejich webu. Odkazy na obchody a na ojeb.cz (zdroj českých srovnávacích cen) otevírají cizí
      weby s vlastními pravidly.
    </p>

    <H2>Vaše práva a kontakt</H2>
    <p>
      Provozovatel o vás žádné osobní údaje neshromažďuje, takže k nim nemá co zpřístupnit ani smazat. S dotazem se
      můžete obrátit na{' '}
      {OPERATOR.email ? (
        <a href={`mailto:${OPERATOR.email}`} className="underline underline-offset-2">
          {OPERATOR.email}
        </a>
      ) : (
        OPERATOR.name
      )}
      . Máte také právo podat stížnost u{' '}
      <a href="https://uoou.gov.cz/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        Úřadu pro ochranu osobních údajů
      </a>
      .
    </p>
  </article>
);
