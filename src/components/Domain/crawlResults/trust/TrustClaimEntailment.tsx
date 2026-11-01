import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClaimCitation } from '@/services/citationEvidence/claims';
import { FOCUS_RING } from './trustHelpers';
import { useEntailmentCheck } from './useEntailmentCheck';

/** Compare shown claims with source text the user pastes (#88). Association evidence only. */
export const TrustClaimEntailment = ({ claims, projectId }: { claims: ClaimCitation[]; projectId?: string | null }) => {
  const { t } = useTranslation();
  const id = useId();
  const [source, setSource] = useState('');
  const check = useEntailmentCheck(claims, projectId);
  return (
    <div className="mt-2 space-y-1" data-testid="trust-entailment">
      <label htmlFor={id} className="block text-slate-300">{t('trust.claims.entail.sourceLabel')}</label>
      <textarea id={id} value={source} onChange={(e) => setSource(e.target.value)} rows={3} maxLength={6000}
        className={`w-full rounded border border-slate-700 bg-slate-950 p-1 text-slate-200 ${FOCUS_RING}`} />
      <label className="flex items-center gap-1 text-slate-400">
        <input type="checkbox" checked={check.useModel} onChange={(e) => check.setUseModel(e.target.checked)} className={FOCUS_RING} />
        {t('trust.claims.entail.useModel')}
      </label>
      <button type="button" disabled={check.busy || !source.trim()} onClick={() => void check.run(source)}
        className={`rounded border border-slate-600 px-2 py-0.5 text-sky-300 hover:bg-slate-800 disabled:opacity-50 ${FOCUS_RING}`}>
        {t('trust.claims.entail.run')}
      </button>
      {check.results.length > 0 && (
        <ul aria-label={t('trust.claims.entail.results')} className="space-y-0.5 text-slate-400">
          {check.results.map((r, i) => (
            <li key={`${claims[i].start}|${claims[i].end}`} data-testid="trust-entail-result" data-label={r.label} data-method={r.method}>
              {t(`trust.claims.entail.label.${r.label}`)} · {t(`trust.claims.entail.method.${r.method}`)} · {claims[i].claim}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-slate-500">{t('trust.claims.entail.note')}</p>
    </div>
  );
};
