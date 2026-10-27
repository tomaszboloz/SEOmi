import { useTranslation } from 'react-i18next';
import type { TopicalDiagnosisReport } from '@/services/topicalDiagnosis';
import type { DiagnosisFilter } from '../CrawlArchitectureTypes';
import { DiagnosisStats } from './DiagnosisStats';
import { DiagnosisVerdictList } from './DiagnosisVerdictList';
import { DiagnosisAreaList } from './DiagnosisAreaList';

interface Props {
  report: TopicalDiagnosisReport;
  onShowInGraph: (filter: DiagnosisFilter) => void;
  onOpenPage: (url: string) => void;
}

/** The default map view: what the crawl says is fine, weak or broken, with the action per URL. */
export const TopicalDiagnosisView = ({ report, onShowInGraph, onOpenPage }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" data-testid="topical-diagnosis-view">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{t('topicalDiagnosis.title')}</h3>
        <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{t('topicalDiagnosis.description')}</p>
      </div>
      <DiagnosisStats stats={report.stats} />
      {report.noTerms && <p role="status" className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">{t('topicalDiagnosis.noTerms')}</p>}
      {report.noContentLinks && <p role="status" className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">{t('topicalDiagnosis.noContentLinks')}</p>}
      {report.truncated && <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-100">{t('topicalDiagnosis.truncated')}</p>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <DiagnosisVerdictList verdicts={report.verdicts} onOpenPage={onOpenPage} />
        <DiagnosisAreaList report={report} onShowInGraph={onShowInGraph} />
      </div>
    </div>
  );
};
