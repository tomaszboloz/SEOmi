import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMapViewTabs } from './CrawlArchitectureTypes';
import type { MapView } from './CrawlArchitectureTypes';
import { scrollMapTabs, returnToResults } from './CrawlArchitectureHelpers';

interface Props { activeView: MapView; setActiveView: (view: MapView) => void; mapTabsRef: RefObject<HTMLDivElement | null>; }

export const CrawlArchitectureHeader = ({ activeView, setActiveView, mapTabsRef }: Props) => {
  const { t } = useTranslation();
  const mapViewTabs = buildMapViewTabs(t);

  const selectMapViewByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLSelectElement) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-map-view]'));
    const currentIndex = buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true' || button.getAttribute('aria-pressed') === 'true');
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : direction ? (currentIndex + direction + buttons.length) % buttons.length : -1;
    if (targetIndex < 0 || !buttons[targetIndex]) return;
    event.preventDefault();
    setActiveView(mapViewTabs[targetIndex].id);
    buttons[targetIndex].focus();
  };

  return (
    <div className="-mx-4 mb-4 border-b border-slate-800 bg-slate-900 px-4 pb-3 pt-0 shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{t('mapUi.eyebrow')}</p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-100">{t('mapUi.title')}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[10px] text-slate-500 sm:inline" aria-live="polite">{t('mapUi.active')}: <span className="font-medium text-slate-300">{mapViewTabs.find((tab) => tab.id === activeView)?.label}</span></span>
          <button type="button" onClick={returnToResults} className="inline-flex h-9 items-center rounded-md border border-slate-700 px-3 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.backToResults')}>{t('mapUi.results')}</button>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
        <button type="button" onClick={() => scrollMapTabs('left', mapTabsRef)} className="grid h-10 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.scrollTabsLeft')} title={t('mapUi.scrollTabsLeft')}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <div ref={mapTabsRef} role="tablist" aria-label={t('mapUi.tablistAria')} onKeyDown={selectMapViewByKey} className="scrollbar-thin flex min-w-0 flex-1 snap-x snap-mandatory gap-1 overflow-x-auto scroll-smooth">
          {mapViewTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeView === tab.id;
            return (
              <button key={tab.id} id={`crawl-map-view-${tab.id}`} data-map-view="true" type="button" role="tab" aria-selected={selected} aria-controls="crawl-map-view-panel" tabIndex={selected ? 0 : -1} onClick={() => setActiveView(tab.id)} className={`flex min-h-11 min-w-[11rem] flex-1 snap-start items-center gap-2 rounded-md px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:min-w-0 ${selected ? tab.id === 'directory' ? 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/20' : tab.id === 'plan' ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/20' : 'bg-slate-800 text-white ring-1 ring-slate-600/60' : 'text-slate-500 hover:bg-slate-800/70 hover:text-slate-200'}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0"><span className="block truncate text-xs font-medium">{tab.label}</span><span aria-hidden="true" className="hidden truncate text-[10px] text-slate-500 sm:block">{tab.description}</span></span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => scrollMapTabs('right', mapTabsRef)} className="grid h-10 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.scrollTabsRight')} title={t('mapUi.scrollTabsRight')}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <p className="mt-1 text-[10px] text-slate-600 sm:hidden">{t('mapUi.compactHint')}</p>
    </div>
  );
};
