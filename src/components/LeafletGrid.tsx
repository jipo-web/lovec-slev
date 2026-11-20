import React, { useState } from 'react';
import { PipelineLeaflet } from '../data/loadData';
import { STORES } from '../data/stores';
import { LeafletPager } from './LeafletPager';
import { ExternalLink, BookOpen } from 'lucide-react';
import { validityInfo } from '../utils/format';

interface LeafletGridProps {
  leaflets: PipelineLeaflet[];
}

export const LeafletGrid: React.FC<LeafletGridProps> = ({ leaflets }) => {
  const [openLeaflet, setOpenLeaflet] = useState<PipelineLeaflet | null>(null);

  if (leaflets.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        Žádné letáky k zobrazení.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Leaflets with extracted offers first; catalogues we only show for browsing after them */}
        {[...leaflets].sort((a, b) => Number(b.offer_count > 0) - Number(a.offer_count > 0)).map((lf) => {
          const store = STORES[lf.store];
          return (
            <div
              key={lf.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
            >
              <button
                onClick={() => setOpenLeaflet(lf)}
                className="block w-full aspect-[3/4] bg-slate-100 dark:bg-slate-800 overflow-hidden"
                title="Otevřít leták"
              >
                {lf.thumbnail_url ? (
                  <img src={lf.thumbnail_url} alt={lf.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <BookOpen className="w-8 h-8" />
                  </div>
                )}
              </button>
              <div className="p-3.5 space-y-1.5 flex-1 flex flex-col">
                <span
                  className="self-start text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase font-mono text-white"
                  style={{ backgroundColor: store.brandColor }}
                >
                  {store.name}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{lf.title}</h3>
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  {validityInfo(lf.valid_from, lf.valid_to).label}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lf.pages} {lf.pages === 1 ? 'strana' : lf.pages >= 2 && lf.pages <= 4 ? 'strany' : 'stran'} ·{' '}
                  {lf.offer_count > 0 ? (
                    `${lf.offer_count} nabídek v přehledu`
                  ) : (
                    <span title="Katalog jsme nezpracovali do přehledu nabídek – lze ho jen prolistovat">jen k prolistování</span>
                  )}
                </div>
                <div className="pt-1 mt-auto flex items-center gap-3 text-[11px] font-medium">
                  <a
                    href={lf.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <ExternalLink className="w-3 h-3" /> Zdroj
                  </a>
                  {lf.pdf_url && (
                    <a
                      href={lf.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <ExternalLink className="w-3 h-3" /> PDF
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {openLeaflet && <LeafletPager leaflet={openLeaflet} onClose={() => setOpenLeaflet(null)} />}
    </>
  );
};
