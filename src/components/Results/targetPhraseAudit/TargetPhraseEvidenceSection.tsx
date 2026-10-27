import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PhraseEvidenceField, TargetPhraseAudit } from '@/services/targetPhraseAudit';

interface TargetPhraseEvidenceSectionProps {
  phrase: string;
  phraseAudit: TargetPhraseAudit | null;
}

export const TargetPhraseEvidenceSection: React.FC<TargetPhraseEvidenceSectionProps> = ({ phrase, phraseAudit }) => {
  const { t } = useTranslation();
  const labels: Record<PhraseEvidenceField, string> = {
    title: t('targetPhraseAuditUi.fields.title'),
    h1: t('targetPhraseAuditUi.fields.h1'),
    body: t('targetPhraseAuditUi.fields.body'),
    anchors: t('targetPhraseAuditUi.fields.anchors'),
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{t('targetPhraseAuditUi.evidenceTitle')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('targetPhraseAuditUi.evidenceDescription')}</p>
        </div>
        {phraseAudit && (
          <span className={`w-fit rounded-full border px-2 py-1 text-[11px] font-semibold ${phraseAudit.completeness === 'complete' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>
            {t(`targetPhraseAuditUi.completeness.${phraseAudit.completeness}`)}
          </span>
        )}
      </div>
      {!phrase.trim() || !phraseAudit ? (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">{t('targetPhraseAuditUi.enterPhrase')}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {phraseAudit.evidence.map((item) => (
              <article key={item.field} className={`rounded-xl border p-3 ${item.occurrences ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/30'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{labels[item.field]}</span>
                  <span className={item.occurrences ? 'text-xs font-semibold text-emerald-300' : 'text-xs font-semibold text-slate-500'}>
                    {t('targetPhraseAuditUi.occurrences', { count: item.occurrences })}
                  </span>
                </div>
                {item.evidence.length ? (
                  <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-400">
                    {item.evidence.map((excerpt, index) => <li key={`${item.field}-${index}`} className="line-clamp-3">{excerpt}</li>)}
                  </ul>
                ) : <p className="mt-2 text-[11px] text-slate-500">{t('targetPhraseAuditUi.noLiteralEvidence')}</p>}
              </article>
            ))}
          </div>
          <dl className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.intent')}: </dt><dd className="inline text-slate-200">{phraseAudit.intent ? t(`targetPhraseAuditUi.intents.${phraseAudit.intent}`) : t('targetPhraseAuditUi.intentUnavailable')}</dd></div>
            <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.auditUrl')}: </dt><dd className="inline break-all text-slate-300">{phraseAudit.url || '—'}</dd></div>
          </dl>
          {phraseAudit.completenessReasons.length > 0 && <p className="mt-3 text-[11px] text-amber-300">{t('targetPhraseAuditUi.partialReason')}</p>}
        </>
      )}
    </section>
  );
};
