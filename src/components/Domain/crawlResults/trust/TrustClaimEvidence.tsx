import { useTranslation } from 'react-i18next';
import type { ClaimCitation } from '@/services/citationEvidence/claims';
import { citationReferenceLabel, citationReferenceUrl } from '@/services/citationEvidence/links';
import { localSupportCheck, type LinkChecker } from '@/services/citationEvidence/support';
import { FOCUS_RING } from './trustHelpers';
import { useSourceReachability } from './useSourceReachability';

const SHOWN = 12;

/**
 * Claim-to-citation evidence (#88): relation, evidence kind, a local support check that reads only the
 * page, resolvable DOI/PMID/PMCID links and, after an explicit click, network reachability of each source.
 */
export const TrustClaimEvidence = ({ claims, unbacked, checker }: { claims: ClaimCitation[]; unbacked?: number; checker?: LinkChecker }) => {
  const { t } = useTranslation();
  const reach = useSourceReachability(claims, checker);
  if (!claims.length) return null;
  return (
    <details className="text-xs text-slate-300">
      <summary className="cursor-pointer">
        {t('trust.signals.claimEvidence')} · {claims.length} · {t('trust.signals.unbacked')} {unbacked ?? '—'}
      </summary>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" disabled={reach.run === 'busy' || !reach.targets} onClick={() => void reach.check()} className={`rounded border border-slate-600 px-2 py-0.5 text-sky-300 hover:bg-slate-800 disabled:opacity-50 ${FOCUS_RING}`}>
          {reach.run === 'busy' ? t('trust.claims.reach.checking') : t('trust.claims.reach.check', { n: reach.targets })}
        </button>
        <span className="text-[10px] text-slate-500">{t('trust.claims.reach.note')}</span>
        {reach.run === 'desktop-only' && <span role="status" className="text-[10px] text-amber-300">{t('trust.claims.reach.desktopOnly')}</span>}
      </div>
      <ul className="mt-1 space-y-1 text-slate-400">
        {claims.slice(0, SHOWN).map((claim) => {
          const support = localSupportCheck(claim);
          return (
            <li key={`${claim.start}|${claim.end}|${claim.claim}`} data-testid="trust-claim">
              <span className="text-slate-200">{t(`trust.claims.relation.${claim.relation}`)}</span>
              {' · '}{t(`trust.claims.evidence.${claim.evidence}`)}
              {' · '}<span data-testid="trust-claim-support" data-level={support.level}>{t(`trust.claims.support.${support.level}`)}</span>
              {support.hedged && <> · {t('trust.claims.support.hedged')}</>}
              {support.negated && <> · {t('trust.claims.support.negated')}</>}
              {' · '}{claim.claim}
              {claim.references.length > 0 ? (
                <ul aria-label={t('trust.claims.references')} className="ms-3 flex flex-wrap gap-x-2">
                  {claim.references.map((ref) => {
                    const href = citationReferenceUrl(ref);
                    const label = citationReferenceLabel(ref);
                    const status = href ? reach.results[href] : undefined;
                    return (
                      <li key={`${ref.start}|${ref.end}`} className="break-all">
                        {href
                          ? <a href={href} target="_blank" rel="noreferrer noopener" className={`text-sky-300 underline ${FOCUS_RING}`}>{label}</a>
                          : <span>{label}</span>}
                        {status && <span data-testid="trust-source-reach" data-status={status} className="ms-1 text-[10px]">({t(`trust.claims.reach.${status}`)})</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="ms-3 text-slate-500">{t('trust.claims.noReference')}</p>}
            </li>
          );
        })}
      </ul>
      {claims.length > SHOWN && <p className="mt-1 text-[10px] text-slate-500">{t('trust.claims.more', { n: claims.length - SHOWN })}</p>}
      <p className="mt-1 text-[10px] text-amber-300">{t('trust.signals.associationNote')}</p>
      <p className="text-[10px] text-slate-500">{t('trust.claims.support.note')}</p>
      <p className="text-[10px] text-slate-500">{t('trust.claims.linkNote')}</p>
    </details>
  );
};
