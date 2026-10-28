import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { HelpId } from '@/components/Help/helpTypes';
import type { SiteFocusReport } from '@/services/siteFocus';
import { isBorderlineTrs } from '@/services/siteFocus/trsPolicy';
import { CRITICAL_BELOW } from './focusHelpers';
import { formatPct } from './focusText';

const Metric = ({ label, value, help }: { label: string; value: ReactNode; help?: HelpId }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
    <dt className="flex items-center gap-1 text-[11px] text-slate-400">{label}{help && <HelpTip id={help} />}</dt>
    <dd className="text-lg font-semibold tabular-nums text-slate-100">{value}</dd>
  </div>
);

export const FocusMetricsStrip = ({ report }: { report: SiteFocusReport }) => {
  const { t } = useTranslation();
  const scored = report.pages.filter((page) => !page.skipped);
  const content = scored.filter((page) => page.type !== 'technical');
  const count = (test: (trs: number) => boolean) => content.filter((page) => test(page.trs)).length;
  return (
    <section aria-label={t('focus.metrics.title')}>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Metric label={t('focus.metrics.confidence')} value={`${formatPct(report.confidence)}%`} help="focus.coreTopicConfidence" />
        <Metric label={t('focus.metrics.onTopic')} value={`${formatPct(report.onTopicRatio)}%`} help="focus.onTopicRatio" />
        <Metric label={t('focus.metrics.pages')} value={scored.length} />
        <Metric label={t('focus.metrics.skipped')} value={report.pages.length - scored.length} />
        <Metric label={t('focus.metrics.offTopic')} value={count((trs) => trs < CRITICAL_BELOW)} />
        <Metric label={t('focus.metrics.borderline')} value={count(isBorderlineTrs)} />
      </dl>
    </section>
  );
};
