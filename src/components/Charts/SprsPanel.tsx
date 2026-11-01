import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SprsReport } from '@/services/semanticGraph/sprs';

/** `limit` shows only the top pages; `labelFor` swaps a node id for a readable page label. */
export interface SprsPanelProps { report: SprsReport; limit?: number; labelFor?: (nodeId: string) => string }

/** Lists SPRS scores and flags. Renders an honest empty state without a graph. The single SPRS panel (#106). */
export const SprsPanel = ({ report, limit, labelFor }: SprsPanelProps) => {
  const { t } = useTranslation();
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('sprsUi.title')}>
    <h4 className="font-semibold">{t('sprsUi.title')} <HelpTip id="sprs.panel" /></h4>
    {report.status === 'unavailable' ? <p role="status" className="text-slate-400">{t('sprsUi.empty')}</p> : <>
      {!report.converged && <p role="status" className="text-amber-300">{t('sprsUi.notConverged')}</p>}
      <table className="w-full text-left">
        <thead><tr><th>{t('sprsUi.page')}</th><th>{t('sprsUi.score')}</th><th>{t('sprsUi.degree')}</th><th /></tr></thead>
        <tbody>{report.pages.slice(0, limit).map((page) => <tr key={page.nodeId}>
          <td className="break-all" title={labelFor ? page.nodeId : undefined}>{labelFor ? labelFor(page.nodeId) : page.nodeId}</td><td>{page.score}</td><td>{page.inDegree}/{page.outDegree}</td>
          <td className="space-x-1">
            {page.deadEnd && <span className="text-rose-300">{t('sprsUi.deadEnd')}</span>}
            {page.underLinked && <span className="text-amber-300">{t('sprsUi.underLinked')}</span>}
            {page.leak && <span className="text-orange-300">{t('sprsUi.leak')}</span>}
          </td>
        </tr>)}</tbody>
      </table>
      <p className="text-slate-500">{t('sprsUi.meta', { iterations: report.iterations, residual: report.residual.toExponential(1) })}</p>
      {report.unknownSimilarityEdges > 0 && <p className="text-slate-400">{t('sprsUi.unknown', { count: report.unknownSimilarityEdges })}</p>}
      {Boolean(report.pageSimilarityWeightedEdges || report.contextSimilarityWeightedEdges) && <p className="text-slate-400">{t('sprsUi.similarityWeighted', { pageEdges: report.pageSimilarityWeightedEdges ?? 0, contextEdges: report.contextSimilarityWeightedEdges ?? 0 })}</p>}
      {report.unweightedZoneLinks > 0 && <p className="text-slate-400">{t('sprsUi.unweightedZone', { count: report.unweightedZoneLinks })}</p>}
    </>}
  </section>;
};
