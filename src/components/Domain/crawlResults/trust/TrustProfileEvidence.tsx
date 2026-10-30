import { useTranslation } from 'react-i18next';
import type { EntityReconciliation, ProfileEvidence } from '@/services/eeatTrust';
import { isKnownProfileDetail, profileIdentifierUrl } from '@/services/eeatTrust/profileLinks';
import { FOCUS_RING } from './trustHelpers';

const SHOWN = 8;
const hostOf = (url: string): string => { try { return new URL(url).hostname; } catch { return url; } };

/**
 * sameAs reconciliation evidence for one entity (#87): translated status, declaration recall (a dash
 * when nothing was reconciled, never 0), and per profile its kind, tier, parsed ORCID/Q-ID linked to the
 * canonical registry page, status and any verification detail.
 */
export const TrustProfileEvidence = ({ reconciliation, profiles }: { reconciliation?: EntityReconciliation; profiles: ProfileEvidence[] }) => {
  const { t } = useTranslation();
  const status = reconciliation?.status ?? 'unavailable';
  const recall = reconciliation ? `${Math.round(reconciliation.declarationRecall * 100)}%` : '—';
  return (
    <details>
      <summary className="cursor-pointer">
        {t('trust.entities.identityEvidence')} · {t(`trust.identity.status.${status}`)} · {recall}
      </summary>
      <ul className="mt-1 space-y-0.5 ps-4">
        {profiles.slice(0, SHOWN).map((profile) => {
          const href = profileIdentifierUrl(profile);
          return (
            <li key={`${profile.kind}|${profile.url}`} className="break-all" data-testid="trust-sameas-profile">
              <span className="text-slate-300">{t(`trust.identity.kind.${profile.kind}`)}</span>
              {profile.tier && <> · {t('trust.identity.tier', { tier: profile.tier })}</>}
              {profile.id && <> · {href
                ? <a href={href} target="_blank" rel="noreferrer noopener" className={`text-sky-300 underline ${FOCUS_RING}`}>{profile.id}</a>
                : <span>{profile.id}</span>}</>}
              {' · '}{t(`trust.identity.status.${profile.status}`)}
              {profile.detail && <> · {isKnownProfileDetail(profile.detail) ? t(`trust.identity.detail.${profile.detail}`) : profile.detail}</>}
              {profile.lookupUrl && profile.fetchedAt && <> · <span data-testid="trust-profile-lookup">{t('trust.identity.checked', { date: profile.fetchedAt.slice(0, 10), source: hostOf(profile.lookupUrl) })}</span></>}
              {' · '}{profile.url}
            </li>
          );
        })}
        {profiles.length > SHOWN && <li>{t('trust.identity.more', { n: profiles.length - SHOWN })}</li>}
        {!profiles.length && <li>{t('trust.entities.unavailableNote')}</li>}
      </ul>
    </details>
  );
};
