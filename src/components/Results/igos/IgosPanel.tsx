import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { buildHeatmap, evidenceAdvice, recommend } from '@/services/igos/heatmap';
import type { IgosReport } from '@/services/igos/report';
import { IgosHeatmap } from './IgosHeatmap';
import { IgosRunDetails } from './IgosRunDetails';
import type { IgosHistoryEntry } from '@/services/igos/history';

const COMPONENTS = ['nefr', 'edsi', 'fhem', 'sdd'] as const;
const pct = (value: number): string => `${Math.round(value * 100)}%`;
const SECTION = 'space-y-3 rounded-lg border border-slate-800 p-4 text-sm text-slate-300';

/** `report` is null until a real TOP-K baseline exists; no baseline never produces a score. */
export const IgosPanel: React.FC<{ report: IgosReport | null; history?: IgosHistoryEntry[] }> = ({ report, history = [] }) => {
  const { t } = useTranslation();
  const head = (
    <h3 className="flex items-center gap-1 font-semibold text-slate-100">{t('igosUi.title')}<HelpTip id="igos.score" /></h3>
  );
  const limits = report?.limitations.map((code) => <p key={code}>{t(`igosUi.limit.${code}`, { defaultValue: code })}</p>);
  if (!report || report.status === 'unavailable') {
    return <section className={SECTION} data-testid="igos-panel">{head}<p>{t('igosUi.empty')}</p>{limits}</section>;
  }
  const sections = buildHeatmap(report);
  const advice = [...recommend(sections), ...evidenceAdvice(report)];
  const counts = { available: report.availableDocs, requested: report.requestedDocs };
  return (
    <section className={SECTION} data-testid="igos-panel">
      {head}
      <p className="text-2xl font-semibold text-white">{report.igos === null ? t('igosUi.noScore') : report.igos}</p>
      {report.status === 'off-topic' && <p role="alert" className="text-amber-300">{t('igosUi.offTopic')}</p>}
      {report.status === 'partial' && <p role="alert" className="text-amber-300">{t('igosUi.partial', counts)}</p>}
      {report.status === 'ready' && <p>{t('igosUi.basis', counts)}</p>}
      {report.components && (
        <ul className="grid grid-cols-2 gap-1">
          {COMPONENTS.map((key) => <li key={key}>{t(`igosUi.component.${key}`)}: {pct(report.components![key])}</li>)}
        </ul>
      )}
      {report.coverage !== null && report.multiplier !== null && (
        <p className="flex items-center gap-1">{t('igosUi.coverage', { coverage: pct(report.coverage), multiplier: report.multiplier.toFixed(2) })}<HelpTip id="igos.coverage" /></p>
      )}
      {report.novelEntities.length > 0 && <p>{t('igosUi.novel', { list: report.novelEntities.join(', ') })}</p>}
      {limits}
      <IgosRunDetails report={report} history={history} />
      <IgosHeatmap sections={sections} />
      {advice.length > 0 && (
        <ul className="list-disc pl-5" aria-label={t('igosUi.advice')}>
          {advice.map((item, i) => <li key={i}>{t(`igosUi.rec.${item.kind}`, { offset: item.offset })}</li>)}
        </ul>
      )}
    </section>
  );
};
