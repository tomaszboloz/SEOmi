import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { PrePublishReport } from '@/services/prePublish/check';

/** Advisory pre-publish card. Shows reasons for every non-ok verdict; never publishes anything. */
export const PrePublishPanel = ({ report }: { report: PrePublishReport }) => {
  const { t } = useTranslation();
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('prePublishUi.title')}>
    <h4 className="font-semibold">{t('prePublishUi.title')} <HelpTip id="prePublish.check" /></h4>
    <p role="status">{t(`prePublishUi.verdict.${report.verdict}`)}</p>
    {report.sfsDelta !== null && <p>{t('prePublishUi.sfs', { before: report.sfsBefore, after: report.sfsAfter, delta: `${report.sfsDelta > 0 ? '+' : ''}${report.sfsDelta}`, trs: report.draftTrs })}</p>}
    {report.reasons.length > 0 && <ul className="list-disc pl-4">{report.reasons.map((r) => <li key={r}>{t(`prePublishUi.reason.${r}`)}</li>)}</ul>}
    {report.conflicts.map((c) => <p key={c.url} className="break-all">{t(`prePublishUi.${c.level}`, { url: c.url, value: (c.similarity * 100).toFixed(1) })}</p>)}
    {report.chunkIssues.map((i) => <p key={`${i.index}-${i.kind}`}>{t(`prePublishUi.chunk.${i.kind}`, { index: i.index + 1 })}</p>)}
  </section>;
};
