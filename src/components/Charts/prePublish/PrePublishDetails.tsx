import { useTranslation } from 'react-i18next';
import type { PrePublishReport } from '@/services/prePublish/check';

const pct = (value: number) => (value * 100).toFixed(1);

/** Policy outcome, link donors and per-passage AIO detail of a pre-publish check (#94). Advice only. */
export const PrePublishDetails = ({ report }: { report: PrePublishReport }) => {
  const { t } = useTranslation();
  const weak = report.chunkDetails?.chunks.filter((chunk) => chunk.weak) ?? [];
  return <div className="space-y-2" data-testid="prepublish-details">
    {report.policy && report.gate && <p role="status">{t(`prePublishUi.gate.${report.gate}`, { policy: t(`prePublishUi.policy.${report.policy}`) })}</p>}
    {report.evidenceGaps?.map((gap) => <p key={gap}>{t(`prePublishUi.gap.${gap}`)}</p>)}
    {report.donors && <section aria-label={t('prePublishUi.donors.title')}>
      <h5 className="font-semibold">{t('prePublishUi.donors.title')}</h5>
      <p>{t('prePublishUi.donors.rule')}</p>
      {!report.donors.length && <p>{t('prePublishUi.donors.none')}</p>}
      <ul className="list-disc pl-4">{report.donors.map((donor) => <li key={donor.url} className="break-all">
        {t('prePublishUi.donors.row', { url: donor.url, similarity: pct(donor.similarity), trs: donor.trs })}
        {' · '}{t(`prePublishUi.donors.links.${donor.alreadyLinks === null ? 'unknown' : donor.alreadyLinks ? 'yes' : 'no'}`)}
        {' · '}{donor.anchor ? t('prePublishUi.donors.anchor', { anchor: donor.anchor }) : t('prePublishUi.donors.noAnchor')}
      </li>)}</ul>
      {report.donors.length > 0 && <p>{t('prePublishUi.donors.placement')}</p>}
    </section>}
    {report.chunkDetails && <section aria-label={t('prePublishUi.aio.title')}>
      <h5 className="font-semibold">{t('prePublishUi.aio.title')}</h5>
      <p>{t(`prePublishUi.aio.language.${report.chunkDetails.languageStatus}`, { language: report.chunkDetails.language })}</p>
      <p>{t('prePublishUi.aio.summary', { weak: weak.length, total: report.chunkDetails.chunks.length })}</p>
      <ul className="space-y-1">{weak.map((chunk) => <li key={chunk.index}>
        <p>{t('prePublishUi.aio.chunk', { index: chunk.index + 1, start: chunk.start, end: chunk.end, score: chunk.score })}
          {chunk.heading ? ` · ${chunk.heading}` : ''}</p>
        <blockquote className="text-slate-400">{chunk.excerpt}</blockquote>
        {chunk.issues.length > 0 && <p>{chunk.issues.map((issue) => t(`aio.issue.${issue}`)).join(' · ')}</p>}
      </li>)}</ul>
    </section>}
  </div>;
};
