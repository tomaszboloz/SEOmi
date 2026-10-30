import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CLAIM_BACKED_PROFILE, SCORING_PROFILE, type ScoringProfile } from '@/services/eeatTrust';

/** Opt-in switch to the claim-backed-v1 reference sub-scoring (#65, #87, #88); legacy stays the default. */
export const TrustScoringToggle = ({ profile, onChange }: { profile: ScoringProfile; onChange: (next: ScoringProfile) => void }) => {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs text-slate-300">
      <input
        id={`${id}-input`}
        type="checkbox"
        className="mt-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        checked={profile === CLAIM_BACKED_PROFILE}
        aria-describedby={`${id}-hint`}
        data-testid="trust-scoring-toggle"
        onChange={(event) => onChange(event.target.checked ? CLAIM_BACKED_PROFILE : SCORING_PROFILE)}
      />
      <div>
        <label htmlFor={`${id}-input`} className="font-medium">{t('trust.scoring.label')}</label>
        <p id={`${id}-hint`} className="text-slate-500">{t('trust.scoring.hint')}</p>
      </div>
    </div>
  );
};
