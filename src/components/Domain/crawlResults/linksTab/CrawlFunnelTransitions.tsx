import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { funnelTransitions, type FunnelPageInput } from '@/services/sija/funnelTransitions';

const STAGES = ['TOFU', 'MOFU', 'BOFU'] as const;

/** #69 GEM-69-06: internal links between funnel stages inferred from measured DOM structure; hidden when no page is classified. */
export const CrawlFunnelTransitions: React.FC<{ pages: FunnelPageInput[] }> = ({ pages }) => {
  const { t } = useTranslation();
  const report = useMemo(() => funnelTransitions(pages), [pages]);
  if (report.classifiedPages === 0) return null;
  return (
    <section className="space-y-1 text-xs text-slate-200" data-testid="crawl-funnel-transitions" aria-label={t('sijaUi.funnel.title')}>
      <h4 className="font-semibold">{t('sijaUi.funnel.title')}</h4>
      <table className="border-collapse">
        <thead>
          <tr>
            <th scope="col" className="px-2 text-start">{t('sijaUi.funnel.fromTo')}</th>
            {STAGES.map((stage) => <th key={stage} scope="col" className="px-2">{stage}</th>)}
          </tr>
        </thead>
        <tbody>
          {STAGES.map((from) => (
            <tr key={from}>
              <th scope="row" className="px-2 text-start">{from}</th>
              {STAGES.map((to) => <td key={to} className="px-2 text-center">{report.transitions[from][to]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-slate-400">{t('sijaUi.funnel.summary', { classified: report.classifiedPages, unclassified: report.unclassifiedPages, skipped: report.skippedLinks })}</p>
    </section>
  );
};
