import { useTranslation } from 'react-i18next';
import { MapPinned, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { KeyboardEvent, RefObject } from 'react';
import { buildMapViewTabs } from './CrawlArchitectureTypes';
import type { MapView } from './CrawlArchitectureTypes';
import { scrollMapTabs, returnToResults, returnToMapStart } from './CrawlArchitectureHelpers';
import { useUIStore } from '@/stores/uiStore';

interface Props { activeView: MapView; setActiveView: (view: MapView) => void; bottomMapTabsRef: RefObject<HTMLDivElement | null>; }

export const CrawlArchitectureBottomNav = ({ activeView, setActiveView, bottomMapTabsRef }: Props) => {
  const { t } = useTranslation();
  const mapViewTabs = buildMapViewTabs(t);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);

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
    <div className={`pointer-events-none fixed inset-x-3 z-40 scroll-mt-28 scroll-mb-48 md:right-4 ${sidebarCollapsed ? 'md:left-[4.5rem]' : 'md:left-[16.5rem]'}`} style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }} data-testid="crawl-map-bottom-navigation">
      <nav aria-label={t('mapUi.bottomNavigationAria')} className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/90 bg-slate-950/95 p-2.5 shadow-2xl shadow-black/50 ring-1 ring-black/20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90">
        <div className="flex min-w-0 flex-1 items-center gap-2" role="toolbar" aria-label={t('mapUi.bottomViewsAria')} onKeyDown={selectMapViewByKey}>
          <MapPinned className="hidden h-4 w-4 shrink-0 text-emerald-300 sm:inline" aria-hidden="true" />
          <span className="hidden shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:inline">{t('mapUi.mapView')}</span>
          <label className="relative min-w-0 flex-1 sm:hidden">
            <span className="sr-only">{t('mapUi.chooseMapView')}</span>
            <select aria-label={t('mapUi.chooseMapView')} value={activeView} onChange={(event) => setActiveView(event.target.value as MapView)} className="h-9 w-full appearance-none rounded-md border border-slate-700 bg-slate-900 px-3 pr-8 text-xs font-medium text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30">
              {mapViewTabs.map((tab) => <option key={`mobile-${tab.id}`} value={tab.id}>{tab.label} · {tab.description}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          </label>
          <button type="button" onClick={() => scrollMapTabs('left', bottomMapTabsRef)} className="hidden h-10 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:grid" aria-label={t('mapUi.scrollBottomLeft')} title={t('mapUi.scrollBottomLeft')}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <div ref={bottomMapTabsRef} className="scrollbar-thin hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth sm:flex" aria-label={t('mapUi.bottomTablistAria')}>
          {mapViewTabs.map((tab) => (
            <button key={`bottom-${tab.id}`} type="button" data-map-view="true" aria-pressed={activeView === tab.id} aria-current={activeView === tab.id ? 'page' : undefined} aria-label={t('mapUi.goToView', { view: tab.label })} onClick={() => setActiveView(tab.id)} className={`min-h-10 shrink-0 rounded-md px-3 py-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${activeView === tab.id ? 'bg-emerald-400/10 text-emerald-200 shadow-inner shadow-emerald-300/5' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>
              <span className="flex items-center gap-1.5"><tab.icon className="h-3.5 w-3.5" aria-hidden="true" />{tab.label}</span>
            </button>
          ))}
          </div>
          <button type="button" onClick={() => scrollMapTabs('right', bottomMapTabsRef)} className="hidden h-10 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:grid" aria-label={t('mapUi.scrollBottomRight')} title={t('mapUi.scrollBottomRight')}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-l border-slate-800 pl-1">
          <span className="hidden px-1 text-[10px] text-slate-500 lg:inline" aria-live="polite">{t('mapUi.active')}: <span className="text-slate-300">{mapViewTabs.find((tab) => tab.id === activeView)?.label}</span> · {mapViewTabs.findIndex((tab) => tab.id === activeView) + 1}/{mapViewTabs.length}</span>
          <button type="button" onClick={returnToMapStart} className="rounded-md px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.backToMapStart')} title={t('mapUi.backToMapStart')}>{t('mapUi.start')}</button>
          <button type="button" onClick={returnToResults} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.backToResults')} title={t('mapUi.backToResults')}>{t('mapUi.results')}</button>
        </div>
      </nav>
    </div>
  );
};
