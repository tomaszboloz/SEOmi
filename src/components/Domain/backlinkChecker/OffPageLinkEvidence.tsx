import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BacklinkProfileData } from '@/types';
import { buildLinkProfile } from '@/services/offPage/linkProfile';
import { anchorContexts } from '@/services/offPage/anchorContext';
import type { SourceEvidence } from '@/services/offPage/sources';

/** Sitewide/duplicate profile of the loaded sample: raw links stay visible, each source domain counts once (#93). */
export const OffPageLinkProfile = ({ profile }: { profile: BacklinkProfileData }) => {
  const { t } = useTranslation();
  const summary = useMemo(() => buildLinkProfile(profile), [profile]);
  return <section className="space-y-1" data-testid="offpage-link-profile" aria-label={t('offPageLinksUi.profileTitle')}>
    <h5 className="font-semibold">{t('offPageLinksUi.profileTitle')}</h5>
    <p>{t('offPageLinksUi.profileSummary', {
      raw: summary.rawLinks, domains: summary.domains, follow: summary.followDomains, sitewide: summary.sitewideDomains, repeated: summary.repeatedDomains,
      share: summary.sitewideShare === null ? t('offPageLinksUi.unknown') : Math.round(summary.sitewideShare * 100),
    })}</p>
    <p>{t(summary.sample ? 'offPageLinksUi.sample' : 'offPageLinksUi.complete')} {t('offPageLinksUi.rule')}</p>
    {summary.rows.length > 0 && <table className="w-full text-start">
      <thead><tr>{(['domain', 'raw', 'follow', 'pages', 'anchors', 'pattern'] as const).map((key) => <th key={key} scope="col">{t(`offPageLinksUi.columns.${key}`)}</th>)}</tr></thead>
      <tbody>{summary.rows.map((row) => <tr key={row.domain}>
        <th scope="row" className="break-all">{row.domain}</th><td>{row.rawLinks}</td><td>{row.follow}</td>
        <td>{row.sourcePages}</td><td>{row.anchors}</td><td>{t(`offPageLinksUi.patterns.${row.pattern}`)}</td>
      </tr>)}</tbody>
    </table>}
  </section>;
};

/** Where each provider-reported anchor appears in the fetched source text; never claims more than the text shows. */
export const OffPageAnchorContexts = ({ profile, sources }: { profile: BacklinkProfileData; sources: SourceEvidence[] }) => {
  const { t } = useTranslation();
  const contexts = useMemo(() => anchorContexts(profile, sources), [profile, sources]);
  return <section className="space-y-1" data-testid="offpage-anchor-contexts" aria-label={t('offPageLinksUi.anchorTitle')}>
    <h5 className="font-semibold">{t('offPageLinksUi.anchorTitle')}</h5>
    <p>{t('offPageLinksUi.anchorNote')}</p>
    {!contexts.length && <p>{t('offPageLinksUi.noAnchors')}</p>}
    <ul className="space-y-1">{contexts.map((context) => <li key={`${context.sourceUrl}\n${context.targetUrl}\n${context.anchor}`} className="break-words">
      <p>{t('offPageLinksUi.anchorRow', { source: context.sourceUrl, target: context.targetUrl, anchor: context.anchor || '—' })}
        {' · '}{t(context.follow ? 'offPageLinksUi.follow' : 'offPageLinksUi.nofollow')}
        {' · '}{t(`offPageLinksUi.status.${context.status}`, { n: context.occurrences })}</p>
      {context.excerpt && <blockquote>{t('offPageLinksUi.offset', { offset: context.offset })} {context.excerpt}</blockquote>}
    </li>)}</ul>
  </section>;
};
