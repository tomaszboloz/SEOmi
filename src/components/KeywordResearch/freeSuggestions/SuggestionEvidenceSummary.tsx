import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SuggestionEvidenceReport } from '@/services/freeSuggestions/suggestionEvidence';

interface Props { report: SuggestionEvidenceReport }
const copy = (t: (key: string, options?: Record<string, unknown>) => string, key: string, fallback: string, options: Record<string, unknown> = {}) => t(key, { defaultValue: fallback, ...options });

export const SuggestionEvidenceSummary: React.FC<Props> = ({ report }) => {
  const { t } = useTranslation();
  const status = !report.hasRun ? copy(t, 'googleSuggestionsUi.evidenceNoCrawl', 'No project crawl evidence is available.') : report.status === 'partial' ? copy(t, 'googleSuggestionsUi.evidencePartial', 'Evidence comes from a partial crawl; unmatched pages may be missing.') : report.status === 'no-evidence' ? copy(t, 'googleSuggestionsUi.evidenceNoMatch', 'No matching title or semantic-term evidence was observed.') : copy(t, 'googleSuggestionsUi.evidenceObserved', 'Observed crawl evidence for this project.');
  return <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3" aria-label={copy(t, 'googleSuggestionsUi.evidenceTitle', 'Crawl evidence')}>
    <h3 className="text-sm font-semibold text-slate-200">{copy(t, 'googleSuggestionsUi.evidenceTitle', 'Crawl evidence')}</h3><p className="text-xs text-slate-400">{status}</p>
    {report.hasRun && <p className="text-xs text-slate-500">{copy(t, 'googleSuggestionsUi.evidenceRun', 'Run {{run}} · {{count}} pages observed.', { run: report.runId, count: report.pagesConsidered })}</p>}
    {report.hasRun && <p className="text-xs text-slate-500">{copy(t, 'googleSuggestionsUi.evidenceLanguage', 'Evidence language: {{language}}.', { language: report.language || 'und' })}</p>}
    {report.partialReasons.includes('invalid-run-timestamp') && <p className="text-xs text-amber-300">{copy(t, 'googleSuggestionsUi.evidenceInvalidTimestamp', 'A crawl with an invalid completion timestamp was ignored.')}</p>}
    {report.truncated && <p className="text-xs text-amber-300">{copy(t, 'googleSuggestionsUi.evidenceTruncated', 'Evidence was bounded: {{pages}} pages, {{suggestions}} suggestions and {{matches}} page matches omitted.', { pages: report.pagesOmitted, suggestions: report.suggestionsOmitted, matches: report.matchesOmitted })}</p>}
    <ul className="space-y-2">{report.items.map((item) => <li key={item.suggestion} aria-label={item.suggestion} className="rounded border border-slate-800 p-2 text-xs text-slate-300"><div className="flex flex-wrap justify-end gap-2"><span>{copy(t, 'googleSuggestionsUi.intentUncertain', '{{intent}} (uncertain)', { intent: item.intent.label })}</span></div>{item.intent.cues.length > 0 && <p className="text-slate-500">{copy(t, 'googleSuggestionsUi.intentSignals', 'Lexical signals: {{signals}}', { signals: item.intent.cues.join(', ') })}</p>}{item.pages.length > 0 ? <ul className="mt-1 space-y-1">{item.pages.map((page) => <li key={page.url}><a href={page.url} target="_blank" rel="noreferrer" className="text-sky-300">{page.title || page.url}</a><span className="ml-2 text-slate-500">{page.scopes.map((scope) => copy(t, `googleSuggestionsUi.evidence${scope === 'title' ? 'TitleMatch' : 'TermsMatch'}`, scope === 'title' ? 'title' : 'semantic terms')).join(', ')}</span></li>)}</ul> : <p className="text-slate-500">{copy(t, 'googleSuggestionsUi.evidenceNoMatch', 'No matching title or semantic-term evidence was observed.')}</p>}</li>)}</ul>
  </section>;
};
