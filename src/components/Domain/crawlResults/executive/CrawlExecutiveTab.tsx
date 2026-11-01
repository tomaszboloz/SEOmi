import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/services/clipboard';
import { hssExportPayload } from '@/services/hss';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import type { CrawlTab } from '../helpers/crawlResultsTabsConfig';
import { ExecutiveActionFeed } from './ExecutiveActionFeed';
import { ExecutiveHssHero } from './ExecutiveHssHero';
import { ExecutiveModuleCards } from './ExecutiveModuleCards';
import { ExecutiveWhatIf } from './ExecutiveWhatIf';
import { useExecutiveData } from './useExecutiveData';
import { useHssTrend } from './useHssTrend';

export interface CrawlExecutiveTabProps {
  pages: CrawledPageSummary[];
  startUrl: string;
  run?: CrawlRunRecord | null;
  projectId?: string | null;
  /** Drill-down: opens an existing module tab inside the same project/run session. */
  onOpenTab: (tab: CrawlTab) => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Executive dashboard (#73): macro (HSS + coverage) → meso (seven module cards) → micro (action feed with
 * drill-down into the existing module screens). Read-only: copy/export never changes the site or a CMS.
 */
export const CrawlExecutiveTab = ({ pages, startUrl, run, projectId, onOpenTab }: CrawlExecutiveTabProps) => {
  const { t, i18n } = useTranslation();
  const { hss, actions, sfs } = useExecutiveData(pages, startUrl, run, projectId);
  const trend = useHssTrend(projectId, hss, run?.completedAt);
  const [copy, setCopy] = useState<CopyState>('idle');
  const exportJson = async () => {
    const payload = { hss: hssExportPayload(hss), actions };
    setCopy((await copyText(JSON.stringify(payload, null, 2))) ? 'copied' : 'failed');
  };
  const date = run?.completedAt ? new Date(run.completedAt).toLocaleString(i18n.language) : null;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-slate-100">{t('executive.title')}</h2>
          <p className="text-xs text-slate-400">{t('executive.subtitle')}</p>
          <p className="text-xs text-slate-400">{date ? t('executive.run', { date }) : t('executive.runUnsaved')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={() => { void exportJson(); }} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            {t('executive.export.copy')}
          </button>
          <span role="status" aria-live="polite" className="text-[11px] text-slate-400">{copy === 'idle' ? t('executive.export.hint') : t(`executive.export.${copy}`)}</span>
        </div>
      </header>
      <p className="text-xs text-slate-300">{t('executive.workflow')}</p>
      <ExecutiveHssHero hss={hss} trend={trend} />
      <ExecutiveModuleCards hss={hss} trend={trend} onOpen={onOpenTab} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ExecutiveActionFeed key={`${projectId ?? ''}|${hss.runId}`} actions={actions} onOpen={onOpenTab} projectId={projectId} hss={hss} focus={sfs ? { report: sfs, pages } : null} />
        <ExecutiveWhatIf key={`${hss.runId}|${hss.profile.version}`} hss={hss} />
      </div>
    </div>
  );
};
