import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { buildGapBrief, type SubtopicCoverage, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import { generateGapBrief, type AuthorityBriefOutcome } from '@/services/topicalAuthorityReference';
import { host } from './authorityText';

const defaultDeps = () => {
  const auth = useAuthStore.getState();
  return { isConfigured: () => auth.isProviderConnected(), generateText: (prompt: string) => auth.generateText(prompt) };
};

/** Architectural brief for a missing sub-topic, with an optional AI-written outline. */
export const GapBriefPanel = ({ report, row, deps = defaultDeps }: { report: TopicalAuthorityReport; row: SubtopicCoverage; deps?: typeof defaultDeps }) => {
  const { t, i18n } = useTranslation();
  const brief = buildGapBrief(report, row);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<AuthorityBriefOutcome | null>(null);
  const generate = async () => {
    setBusy(true);
    setOutcome(await generateGapBrief(deps(), brief, report.taxonomy?.coreLabel ?? '', i18n.language));
    setBusy(false);
  };
  return (
    <section aria-labelledby="authority-brief-title" className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
      <h4 id="authority-brief-title" className="text-sm font-semibold text-slate-100">{t('authority.brief.title')}</h4>
      <p>{t('authority.brief.path')}: <code className="break-all">{brief.suggestedPath}</code></p>
      <p>{t('authority.brief.h1')}: {brief.h1}</p>
      {brief.entities.length > 0 && <p>{t('authority.brief.entities')}: {brief.entities.join(', ')}</p>}
      {brief.questions.length > 0 && <p>{t('authority.brief.questions')}: {brief.questions.join(' · ')}</p>}
      {brief.linkFrom && <p>{t('authority.brief.linkFrom')}: <code className="break-all">{host(brief.linkFrom)}</code></p>}
      {brief.linkTo && <p>{t('authority.brief.linkTo')}: <code className="break-all">{host(brief.linkTo)}</code></p>}
      <p className="text-emerald-300">{t('authority.brief.impact', { value: brief.impact })}</p>
      <button type="button" disabled={busy} onClick={() => void generate()} className="rounded-lg border border-emerald-500/40 px-3 py-1 text-emerald-200 disabled:opacity-50">{busy ? t('authority.brief.generating') : t('authority.brief.generate')}</button>
      {outcome?.status === 'ok' && <pre className="whitespace-pre-wrap rounded bg-slate-900 p-2 text-[11px]" data-testid="authority-ai-brief">{outcome.text}</pre>}
      {outcome?.status === 'no-key' && <p role="alert" className="text-amber-200">{t('authority.brief.noKey')}</p>}
      {outcome?.status === 'empty' && <p role="alert" className="text-amber-200">{t('authority.brief.empty')}</p>}
      {outcome?.status === 'error' && <p role="alert" className="text-red-300">{t('authority.brief.error', { error: outcome.message })}</p>}
    </section>
  );
};
