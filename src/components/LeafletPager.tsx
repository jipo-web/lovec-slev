import React, { useState } from 'react';
import { PipelineLeaflet } from '../data/loadData';
import { STORES } from '../data/stores';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface LeafletPagerProps {
  leaflet: PipelineLeaflet;
  onClose: () => void;
}

export const LeafletPager: React.FC<LeafletPagerProps> = ({ leaflet, onClose }) => {
  const [index, setIndex] = useState(0);
  const pages = leaflet.page_image_urls;
  const total = pages.length;
  const store = STORES[leaflet.store];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {store.name} · {leaflet.title}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Platnost {leaflet.valid_from} – {leaflet.valid_to}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Zavřít"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex items-start justify-center p-3">
          {total > 0 ? (
            <img
              key={pages[index]}
              src={pages[index]}
              alt={`${leaflet.title}, strana ${index + 1}`}
              className="max-w-full h-auto rounded-lg shadow-md"
            />
          ) : (
            <div className="p-10 text-xs text-slate-500 dark:text-slate-400">
              Pro tento leták nejsou k dispozici náhledy stran.
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index <= 0}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Předchozí</span>
          </button>
          <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            Strana {total > 0 ? index + 1 : 0} / {total}
          </span>
          <button
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            disabled={index >= total - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-40"
          >
            <span>Další</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
