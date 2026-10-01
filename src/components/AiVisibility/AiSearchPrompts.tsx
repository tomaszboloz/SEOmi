import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Bot,
  Sparkles,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { matchAiCitationToCrawl } from '@/services/aiCitationEvidence';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { copyText } from '@/services/clipboard';

export const AiSearchPrompts: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const aiSearchPrompt = useToolsStore((s) => s.aiSearchPrompt);
  const aiPromptComparison = useToolsStore((s) => s.aiPromptComparison);
  const aiPromptHistory = useToolsStore((s) => s.aiPromptHistory);
  const isLoading = useToolsStore((s) => s.isAiPromptLoading);
  const error = useToolsStore((s) => s.aiPromptError);
  const setAiSearchPrompt = useToolsStore((s) => s.setAiSearchPrompt);
  const runAiPromptComparison = useToolsStore((s) => s.runAiPromptComparison);
  const selectAiPromptComparison = useToolsStore((s) => s.selectAiPromptComparison);
  const crawlRuns = useToolsStore((s) => s.crawlRuns);
  const selectedCrawlRunId = useToolsStore((s) => s.selectedCrawlRunId);

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sourceContextRunId, setSourceContextRunId] = useState('');
  const [sourceContextSaveError, setSourceContextSaveError] = useState(false);
  const sourceContextKey = projectId ? `seomi_project_${projectId}_ai_citation_crawl_context_v1` : '';
  const sourceContextRun = crawlRuns.find((run) => run.id === sourceContextRunId) ?? null;

  useEffect(() => {
    if (!projectId || !sourceContextKey) {
      setSourceContextRunId('');
      return;
    }
    const saved = readStorage(sourceContextKey);
    const available = saved && crawlRuns.some((run) => run.id === saved) ? saved : '';
    setSourceContextRunId(available || (crawlRuns.some((run) => run.id === selectedCrawlRunId) ? selectedCrawlRunId || '' : crawlRuns[0]?.id || ''));
    setSourceContextSaveError(false);
  }, [projectId, sourceContextKey, crawlRuns, selectedCrawlRunId]);

  const selectSourceContextRun = (runId: string) => {
    setSourceContextRunId(runId);
    if (!sourceContextKey) return;
    const saved = runId ? writeStorage(sourceContextKey, runId) : removeStorage(sourceContextKey);
    setSourceContextSaveError(!saved);
  };

  const citationsWithEvidence = useMemo(
    () => (aiPromptComparison?.results ?? []).map((result) => result.citations.map((citation) => matchAiCitationToCrawl(citation, sourceContextRun, result.response_text))),
    [aiPromptComparison, sourceContextRun],
  );

  const citationSummaries = useMemo(
    () => (aiPromptComparison?.results ?? []).map((result, resultIndex) => {
      const evidence = citationsWithEvidence[resultIndex] ?? [];
      return {
        total: result.citations.length,
        matched: evidence.filter((item) => item.matched).length,
        contextual: evidence.filter((item) => item.context?.meetsMinimum).length,
        sentenceMatches: evidence.filter((item) => item.context?.sentenceMatch).length,
      };
    }),
    [aiPromptComparison, citationsWithEvidence],
  );

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSearchPrompt.trim()) return;
    setAiSearchPrompt(aiSearchPrompt.trim());
    runAiPromptComparison(aiSearchPrompt.trim());
  };

  const samplePrompts = t('aiVisibility.samplePrompts', { returnObjects: true }) as string[];

  const handleCopy = async (text: string, idx: number) => {
    const copied = await copyText(text);
    if (!copied) return;
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('aiVisibility.search.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('aiVisibility.search.eyebrow')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('aiVisibility.search.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('aiVisibility.search.description')}
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{t('aiVisibility.search.localOnly')}</span>
        </div>
      </div>

      {/* Input Form */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 shadow-lg">
        <form onSubmit={handleCompare} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <MessageSquare className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              aria-label={t('aiVisibility.search.promptLabel')}
              value={aiSearchPrompt}
              onChange={(e) => setAiSearchPrompt(e.target.value)}
              placeholder={t('aiVisibility.search.promptPlaceholder')}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('aiVisibility.search.runLoading')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t('aiVisibility.search.run')}</span>
              </>
            )}
          </button>
        </form>

        {/* Sample Prompt Pills */}
        <div className="flex items-center flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] text-slate-400">{t('aiVisibility.search.samplesLabel')}</span>
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setAiSearchPrompt(p);
                runAiPromptComparison(p);
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition truncate max-w-xs"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {aiPromptComparison && aiPromptHistory.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <label htmlFor="ai-prompt-history" className="text-xs text-slate-300">{t('aiVisibility.search.historyLabel')}</label>
          <select id="ai-prompt-history" aria-label={t('aiVisibility.search.historyAria')} value={aiPromptComparison.captured_at} onChange={(event) => selectAiPromptComparison(event.target.value)} className="min-w-64 max-w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
            {aiPromptHistory.map((comparison) => <option key={comparison.captured_at} value={comparison.captured_at}>{new Date(comparison.captured_at).toLocaleString()} · {comparison.prompt}</option>)}
          </select>
          <span className="text-[10px] text-slate-500">{t('aiVisibility.search.historyNote')}</span>
        </div>
      )}

      {aiPromptComparison && <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-200">{t('aiVisibility.search.sourceTitle')}</h3><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">{t('aiVisibility.search.sourceDescription')}</p></div>
          <label className="min-w-64 text-[10px] text-slate-400">{t('aiVisibility.search.sourceLabel')}
            <select aria-label={t('aiVisibility.search.sourceAria')} value={sourceContextRunId} onChange={(event) => selectSourceContextRun(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100">
              <option value="">{t('aiVisibility.search.noSnapshot')}</option>
              {crawlRuns.map((run) => <option key={run.id} value={run.id}>{new Date(run.completedAt).toLocaleString()} · {run.startUrl} · {t('crawl.ui.urlsCount', { count: run.result.pages_crawled })}</option>)}
            </select>
          </label>
        </div>
        {sourceContextSaveError && <p role="alert" className="mt-2 text-[10px] text-amber-200">{t('aiVisibility.search.sourceSaveError')}</p>}
        {sourceContextRun && <p className="mt-2 text-[10px] text-slate-500">{t('aiVisibility.search.evidenceRun', { id: sourceContextRun.id, date: new Date(sourceContextRun.completedAt).toLocaleString(), count: sourceContextRun.result.pages.length })}</p>}
      </section>}

      {/* Comparison Columns */}
      {aiPromptComparison && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-bold text-white text-base">{t('aiVisibility.search.localResponses')}</h3><p className="mt-1 text-[10px] text-slate-500">{t('aiVisibility.search.promptStarted', { date: new Date(aiPromptComparison.captured_at).toLocaleString() })}</p></div>
            <span className="max-w-xl text-xs text-slate-400">{t('aiVisibility.search.promptPrefix', { prompt: aiPromptComparison.prompt })}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {aiPromptComparison.results.map((res, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between space-y-4 shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-400" />
                      <span>{res.model_name}</span>
                    </div>

                    <button
                      onClick={() => handleCopy(res.response_text, idx)}
                      className="text-slate-400 hover:text-white p-1 rounded transition"
                      title={t('aiVisibility.search.copyResponse')}
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Output Text */}
                  {res.search_mode && <p className="text-xs text-slate-400">{t(`aiResearch.${res.search_mode}`)} · {t('aiResearch.position', { value: res.mention_position ?? '—' })} · {t(res.own_domain_cited ? 'aiResearch.ownDomainYes' : 'aiResearch.ownDomainNo')}</p>}
                  {res.brand_mentions.length > 0 && <p className="text-xs text-emerald-300">{res.brand_mentions.join(', ')}</p>}
                  <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                    {res.response_status === 'error' ? <span className="text-rose-200">{t('aiVisibility.search.noResponse', { message: res.error_message })}</span> : res.response_text}
                  </div>
                  <p className="text-[10px] text-slate-600">{t('aiVisibility.search.providerMeta', { provider: res.provider, date: new Date(res.captured_at).toLocaleString() })}</p>
                </div>

                {/* Citations */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                    {t('aiVisibility.search.citationsLabel')}
                  </div>
                  {(() => {
                    const summary = citationSummaries[idx];
                    if (!summary) return null;
                    return (
                      <p
                        aria-label={t('aiVisibility.search.citationSummaryAria', { provider: res.provider })}
                        className="mb-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[10px] leading-4 text-slate-400"
                      >
                        {t('aiVisibility.search.citations')} <span className="font-mono text-slate-200">{summary.total}</span>
                        {' · '}{t('aiVisibility.search.inSnapshot')} <span className="font-mono text-emerald-300">{summary.matched}</span>
                        {' · '}{t('aiVisibility.search.contextSignal')} <span className="font-mono text-sky-300">{summary.contextual}</span>
                        {' · '}{t('aiVisibility.search.sentenceMatch')} <span className="font-mono text-violet-300">{summary.sentenceMatches}</span>
                      </p>
                    );
                  })()}
                  <div className="space-y-1">
                    {res.citations.map((cite, cIdx) => (
                      <div key={cIdx} className="text-[11px] font-mono text-emerald-400 truncate flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                        <a href={cite} target="_blank" rel="noreferrer">{cite}</a>
                      </div>
                    ))}
                    {!res.citations.length && <p className="text-[10px] text-slate-600">{t('aiVisibility.search.noUrls')}</p>}
                  </div>
                  {res.citations.length > 0 && <ul aria-label={t('aiVisibility.search.citationContextAria', { provider: res.provider })} className="mt-2 space-y-1.5">
                    {res.citations.map((cite, cIdx) => {
                      const evidence = citationsWithEvidence[idx]?.[cIdx];
                      const statusLabel = !sourceContextRun ? t('aiVisibility.search.statusNoSnapshot') : !evidence?.normalizedUrl ? t('aiVisibility.search.statusInvalidUrl') : !evidence.matched ? t('aiVisibility.search.statusAbsent') : t('aiVisibility.search.statusPresent', { status: evidence.page?.http_status ?? '—', indexability: evidence.page?.indexability_status || t('aiVisibility.search.indexabilityUnknown') });
                      const matchDetail = evidence?.matched ? evidence.matchKind ? t('aiVisibility.search.matchDetail', { label: evidence.page?.title || evidence.page?.final_url || evidence.page?.url || '', kind: evidence.matchKind }) : evidence.page?.title || evidence.page?.final_url || evidence.page?.url || '' : '';
                      const contextDetail = evidence?.context
                        ? `${t('aiVisibility.search.lexicalContext', { matched: evidence.context.matchedTerms.length, total: evidence.context.sourceTermCount, detail: evidence.context.scope === 'sentence-match' ? t('aiVisibility.search.sentenceContext', { percent: evidence.context.sentenceOverlapPercent ?? 0 }) : evidence.context.scope === 'excerpt' ? t('aiVisibility.search.excerptContext') : evidence.context.scope === 'semantic-terms' ? t('aiVisibility.search.semanticContext') : evidence.context.scope === 'title' ? t('aiVisibility.search.titleContext') : t('aiVisibility.search.noSignalContext') })}${evidence.context.meetsMinimum ? ` · ${t('aiVisibility.search.observableSignal')}` : ` · ${t('aiVisibility.search.belowThreshold')}`}`
                        : '';
                      const spanDetail = evidence?.context
                        ? [
                          evidence.context.responseSpan ? t('aiVisibility.search.responseRange', { start: evidence.context.responseSpan.start, end: evidence.context.responseSpan.end }) : '',
                          evidence.context.sourceSpan ? t(evidence.context.sourceSpan.source === 'title' ? 'aiVisibility.search.sourceRangeTitle' : 'aiVisibility.search.sourceRangeExcerpt', { start: evidence.context.sourceSpan.start, end: evidence.context.sourceSpan.end }) : '',
                        ].filter(Boolean).join(' · ')
                        : '';
                      return <li key={`${cite}-${cIdx}`} className={`rounded border px-2 py-1.5 text-[9px] ${evidence?.matched ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-slate-800 text-slate-500'}`}>
                        <span className="block break-all">{statusLabel}</span>{matchDetail && <span className="mt-0.5 block break-words text-slate-500">{matchDetail}</span>}{contextDetail && <span className="mt-0.5 block break-words text-slate-500">{contextDetail}{evidence?.context?.matchedTerms.length ? ` · ${evidence.context.matchedTerms.join(', ')}` : ''}</span>}{spanDetail && <span className="mt-0.5 block break-words text-slate-500">{t('aiVisibility.search.evidenceRange', { range: spanDetail })}</span>}{evidence?.context?.matchedTermEvidence?.length ? <span className="mt-0.5 block break-words text-slate-500">{t('aiVisibility.search.termPositions', { terms: evidence.context.matchedTermEvidence.map((term) => `${term.term}${term.response ? ` @${term.response.start}–${term.response.end}` : ''}`).join(', ') })}</span> : null}{evidence?.context?.matchedResponseSentence && <span className="mt-0.5 block break-words text-slate-600">{t('aiVisibility.search.responseSentence', { text: evidence.context.matchedResponseSentence })}</span>}{evidence?.context?.matchedExcerpt && <span className="mt-0.5 block break-words text-slate-600">{t('aiVisibility.search.localExcerpt', { text: evidence.context.matchedExcerpt })}</span>}
                      </li>;
                    })}
                  </ul>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
