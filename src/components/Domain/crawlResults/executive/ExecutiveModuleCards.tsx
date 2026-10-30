import { useTranslation } from 'react-i18next';
import type { HssModule, HssReport } from '@/services/hss';
import type { CrawlTab } from '../helpers/crawlResultsTabsConfig';

/** Existing screens the module cards open; modules without a site-level view have no link. */
export const MODULE_TAB: Record<HssModule, CrawlTab | null> = {
  sfs: 'focus', tas: 'authority', igos: null, sprs: 'visualisations', eetv: 'trust', sija: null, aior: 'aio',
};

/** Meso level (#73 GEM-73-03): seven module cards with value, weight, status and the reason for a gap. */
export const ExecutiveModuleCards = ({ hss, onOpen }: { hss: HssReport; onOpen: (tab: CrawlTab) => void }) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="executive-modules-title" className="space-y-2">
      <h2 id="executive-modules-title" className="text-sm font-semibold text-slate-200">{t('executive.modules.title')}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {hss.components.map((item) => {
          const tab = MODULE_TAB[item.module];
          return (
            <li key={item.module} className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
              <span className="font-medium text-slate-100">{t(`executive.module.${item.module}`)}</span>
              <span className="font-mono text-2xl text-slate-100">{item.value ?? '—'}</span>
              <span>{t(`executive.componentStatus.${item.status}`)} · {t('executive.modules.weight', { weight: Math.round(item.weight * 100), effective: Math.round(item.effectiveWeight * 1000) / 10 })}</span>
              {item.status !== 'measured' && item.reason && <span className="text-slate-400">{t(`executive.reason.${item.reason}`, { defaultValue: item.reason })}</span>}
              {item.status === 'measured' && item.reason && <span className="text-amber-200">{t(`executive.reason.${item.reason}`, { defaultValue: item.reason })}</span>}
              {tab && (
                <button type="button" onClick={() => onOpen(tab)} className="mt-auto self-start rounded border border-slate-700 px-2 py-1 text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                  {t('executive.modules.open')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
