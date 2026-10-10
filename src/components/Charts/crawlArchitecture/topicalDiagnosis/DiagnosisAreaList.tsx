import { useTranslation } from 'react-i18next';
import type { DiagnosisArea, DiagnosisTopic, TopicalDiagnosisReport } from '@/services/topicalDiagnosis';
import type { DiagnosisFilter } from '../CrawlArchitectureTypes';
import { shortPath } from './verdictText';

interface Props {
  report: TopicalDiagnosisReport;
  onShowInGraph: (filter: DiagnosisFilter) => void;
}

const TopicRow = ({ topic, onShowInGraph }: { topic: DiagnosisTopic; onShowInGraph: Props['onShowInGraph'] }) => {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800/80 px-2 py-1.5">
      <span className="min-w-0 text-xs text-slate-200">
        {topic.labelSource === 'none' ? <em className="text-slate-500">{t('topicalDiagnosis.topics.noLabel')}</em> : topic.label}
        {topic.labelSource === 'content' && <span className="ml-1 text-[10px] text-slate-500">({t('topicalDiagnosis.topics.labelFromContent')})</span>}
        <span className="ml-2 text-[10px] text-slate-500">{t('topicalDiagnosis.topics.documents', { count: topic.documentIds.length })}</span>
      </span>
      <button type="button" onClick={() => onShowInGraph({ kind: 'topic', id: topic.id })} className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-sky-400 hover:text-sky-200">
        {t('topicalDiagnosis.areas.showInGraph')}
      </button>
    </li>
  );
};

const AreaCard = ({ area, report, onShowInGraph }: Props & { area: DiagnosisArea }) => {
  const { t } = useTranslation();
  const members = new Set(area.documentIds);
  const hub = area.hubId ? report.documents.find((document) => document.id === area.hubId) : undefined;
  const topics = report.topics.filter((topic) => topic.documentIds.some((id) => members.has(id)));
  const inTopics = new Set(topics.flatMap((topic) => topic.documentIds));
  const singles = area.documentIds.filter((id) => !inTopics.has(id)).length;
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-100">{area.hubId ? area.label : t('topicalDiagnosis.areas.noHub')}</p>
          {hub && <p className="break-all font-mono text-[10px] text-slate-500">{t('topicalDiagnosis.areas.hub', { url: shortPath(hub.primaryPage.url) })}</p>}
          <p className="text-[10px] text-slate-500">
            {area.documentIds.length ? t('topicalDiagnosis.areas.members', { count: area.documentIds.length }) : t('topicalDiagnosis.areas.hubWithoutMembers')}
            {singles > 0 && ` · ${t('topicalDiagnosis.topics.singletons', { count: singles })}`}
          </p>
        </div>
        <button type="button" onClick={() => onShowInGraph({ kind: 'area', id: area.id })} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-sky-400 hover:text-sky-200">
          {t('topicalDiagnosis.areas.showInGraph')}
        </button>
      </div>
      {topics.length > 0 && (
        <ul className="mt-2 space-y-1">
          {topics.map((topic) => <TopicRow key={topic.id} topic={topic} onShowInGraph={onShowInGraph} />)}
        </ul>
      )}
    </li>
  );
};

export const DiagnosisAreaList = ({ report, onShowInGraph }: Props) => {
  const { t } = useTranslation();
  return (
    <section aria-label={t('topicalDiagnosis.areas.title')} className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-100">{t('topicalDiagnosis.areas.title')}</h4>
      <ul className="space-y-2">
        {report.areas.map((area) => <AreaCard key={area.id} area={area} report={report} onShowInGraph={onShowInGraph} />)}
      </ul>
    </section>
  );
};
