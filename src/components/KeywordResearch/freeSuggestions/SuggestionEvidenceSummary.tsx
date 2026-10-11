import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SuggestionEvidenceReport } from '@/services/freeSuggestions/suggestionEvidence';

interface Props { report: SuggestionEvidenceReport }

export const SuggestionEvidenceSummary: React.FC<Props> = ({ report }) => {
  const { t } = useTranslation();
  const status = !report.hasRun ? t('googleSuggestionsUi.evidenceNoCrawl') : report.status === 'partial' ? t('googleSuggestionsUi.evidencePartial') : report.status === 'no-evidence' ? t('googleSuggestionsUi.evidenceNoMatch') : t('googleSuggestionsUi.evidenceObserved');
  return <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3" aria-label={t('googleSuggestionsUi.evidenceTitle')}>
    <h3 className="text-sm font-semibold text-slate-200">{t('googleSuggestionsUi.evidenceTitle')}</h3><p className="text-xs text-slate-400">{status}</p>
    {report.hasRun && <p className="text-xs text-slate-500">{t('googleSuggestionsUi.evidenceRun', { run: report.runId, count: report.pagesConsidered })}</p>}
    {report.hasRun && <p className="text-xs text-slate-500">{t('googleSuggestionsUi.evidenceLanguage', { language: report.language || 'und' })}</p>}
    {report.partialReasons.includes('invalid-run-timestamp') && <p className="text-xs text-amber-300">{t('googleSuggestionsUi.evidenceInvalidTimestamp')}</p>}
    {report.truncated && <p className="text-xs text-amber-300">{t('googleSuggestionsUi.evidenceTruncated', { pages: report.pagesOmitted, suggestions: report.suggestionsOmitted, matches: report.matchesOmitted })}</p>}
    <ul className="space-y-2">{report.items.map((item) => <li key={item.suggestion} aria-label={item.suggestion} className="rounded border border-slate-800 p-2 text-xs text-slate-300"><div className="flex flex-wrap justify-end gap-2"><span>{t('googleSuggestionsUi.intentUncertain', { intent: item.intent.label })}</span></div>{item.intent.cues.length > 0 && <p className="text-slate-500">{t('googleSuggestionsUi.intentSignals', { signals: item.intent.cues.join(', ') })}</p>}{item.pages.length > 0 ? <ul className="mt-1 space-y-1">{item.pages.map((page) => <li key={page.url}><a href={page.url} target="_blank" rel="noreferrer" className="text-sky-300">{page.title || page.url}</a><span className="ml-2 text-slate-500">{page.scopes.map((scope) => t(`googleSuggestionsUi.evidence${scope === 'title' ? 'TitleMatch' : 'TermsMatch'}`)).join(', ')}</span></li>)}</ul> : <p className="text-slate-500">{t('googleSuggestionsUi.evidenceNoMatch')}</p>}</li>)}</ul>
  </section>;
};
