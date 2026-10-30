import { useTranslation } from 'react-i18next';
import type { ClaimCitation } from '@/services/citationEvidence/claims';
import { citationReferenceLabel, citationReferenceUrl } from '@/services/citationEvidence/links';
import { FOCUS_RING } from './trustHelpers';

const SHOWN = 12;

/** Claim-to-citation evidence (#88): relation, evidence kind and resolvable DOI/PMID/PMCID links. */
export const TrustClaimEvidence = ({ claims, unbacked }: { claims: ClaimCitation[]; unbacked?: number }) => {
  const { t } = useTranslation();
  if (!claims.length) return null;
  return (
    <details className="text-xs text-slate-300">
      <summary className="cursor-pointer">
        {t('trust.signals.claimEvidence')} · {claims.length} · {t('trust.signals.unbacked')} {unbacked ?? '—'}
      </summary>
      <ul className="mt-1 space-y-1 text-slate-400">
        {claims.slice(0, SHOWN).map((claim) => (
          <li key={`${claim.start}|${claim.end}|${claim.claim}`} data-testid="trust-claim">
            <span className="text-slate-200">{t(`trust.claims.relation.${claim.relation}`)}</span>
            {' · '}{t(`trust.claims.evidence.${claim.evidence}`)} · {claim.claim}
            {claim.references.length > 0 ? (
              <ul aria-label={t('trust.claims.references')} className="ms-3 flex flex-wrap gap-x-2">
                {claim.references.map((ref) => {
                  const href = citationReferenceUrl(ref);
                  const label = citationReferenceLabel(ref);
                  return (
                    <li key={`${ref.start}|${ref.end}`} className="break-all">
                      {href
                        ? <a href={href} target="_blank" rel="noreferrer noopener" className={`text-sky-300 underline ${FOCUS_RING}`}>{label}</a>
                        : <span>{label}</span>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="ms-3 text-slate-500">{t('trust.claims.noReference')}</p>}
          </li>
        ))}
      </ul>
      {claims.length > SHOWN && <p className="mt-1 text-[10px] text-slate-500">{t('trust.claims.more', { n: claims.length - SHOWN })}</p>}
      <p className="mt-1 text-[10px] text-amber-300">{t('trust.signals.associationNote')}</p>
      <p className="text-[10px] text-slate-500">{t('trust.claims.linkNote')}</p>
    </details>
  );
};
