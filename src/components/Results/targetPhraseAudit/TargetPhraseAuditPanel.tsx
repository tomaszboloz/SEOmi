import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageAuditData } from '@/types';
import { TargetPhraseEvidenceSection } from './TargetPhraseEvidenceSection';
import { TargetPhraseTopTenSection } from './TargetPhraseTopTenSection';
import { useTargetPhraseAuditSession } from './useTargetPhraseAuditSession';

export const TargetPhraseAuditPanel: React.FC<{ audit: PageAuditData }> = ({ audit }) => {
  const { t } = useTranslation();
  const session = useTargetPhraseAuditSession(audit);
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/25 p-1">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{t('targetPhraseAuditUi.title')}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{t('targetPhraseAuditUi.description')}</p>
        <label className="mt-4 block text-xs font-medium text-slate-300">
          {t('targetPhraseAuditUi.phraseLabel')}
          <input
            value={session.phrase}
            onChange={(event) => session.setPhrase(event.target.value)}
            placeholder={t('targetPhraseAuditUi.phrasePlaceholder')}
            disabled={!session.activeProjectId}
            className="mt-2 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </header>
      <TargetPhraseEvidenceSection phrase={session.phrase} phraseAudit={session.evidence} />
      <TargetPhraseTopTenSection
        phrase={session.phrase}
        source={session.source}
        report={session.report}
        unavailableReason={session.unavailableReason}
        canAudit={session.canAudit}
        isLoading={session.isLoading}
        error={session.error}
        onAudit={() => { void session.auditTopTen(); }}
      />
    </section>
  );
};
