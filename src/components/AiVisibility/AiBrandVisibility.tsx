import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Bot,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';

export const AiBrandVisibility: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.projects.find((project) => project.id === s.activeProjectId));
  const aiBrandQuery = useToolsStore((s) => s.aiBrandQuery);
  const aiBrandDomain = useToolsStore((s) => s.aiBrandDomain);
  const aiBrandReport = useToolsStore((s) => s.aiBrandReport);
  const aiBrandHistory = useToolsStore((s) => s.aiBrandHistory);
  const isLoading = useToolsStore((s) => s.isAiBrandLoading);
  const error = useToolsStore((s) => s.aiBrandError);
  const setAiBrandQuery = useToolsStore((s) => s.setAiBrandQuery);
  const setAiBrandDomain = useToolsStore((s) => s.setAiBrandDomain);
  const analyzeAiBrandVisibility = useToolsStore((s) => s.analyzeAiBrandVisibility);
  const selectAiBrandReport = useToolsStore((s) => s.selectAiBrandReport);

  const researchSettings = useToolsStore((s) => s.aiResearchSettings);
  const setResearchSettings = useToolsStore((s) => s.setAiResearchSettings);
  const [prompts, setPrompts] = useState(researchSettings.prompts.join('\n'));
  const [competitors, setCompetitors] = useState(researchSettings.competitors.join('\n'));
  useEffect(() => { setPrompts(researchSettings.prompts.join('\n')); setCompetitors(researchSettings.competitors.join('\n')); }, [activeProjectId, researchSettings]);

  const connectionMethod = useAuthStore((s) => s.connectionMethod);
  const connectionStatus = useAuthStore((s) => s.connectionStatus);
  const connectedProviders = (['openai', 'claude', 'gemini'] as const).filter((item) => connectionMethod[item] === 'local_cli' && connectionStatus[item] === 'connected');
  const initializedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const projectRoot = activeProject?.rootUrl?.trim();
    if (!activeProjectId || initializedProjectRef.current === activeProjectId) return;
    initializedProjectRef.current = activeProjectId;
    if (!projectRoot || aiBrandDomain.trim()) return;
    setAiBrandDomain(projectRoot);
  }, [activeProject?.rootUrl, activeProjectId, aiBrandDomain, setAiBrandDomain]);

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiBrandQuery.trim()) return;
    setAiBrandQuery(aiBrandQuery.trim());
    setAiBrandDomain(aiBrandDomain.trim());
    setResearchSettings({ prompts: prompts.split(/\n/), competitors: competitors.split(/\n/) });
    analyzeAiBrandVisibility(aiBrandQuery.trim(), aiBrandDomain.trim());
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'neutral':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'negative':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('aiVisibility.brand.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('aiVisibility.brand.eyebrow')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('aiVisibility.brand.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('aiVisibility.brand.description')}
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            {connectedProviders.length ? t('aiVisibility.brand.connected', { count: connectedProviders.length }) : t('aiVisibility.brand.requiredConnection')}
          </span>
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleQuery}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Bot className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label={t('aiVisibility.brand.brandLabel')}
            value={aiBrandQuery}
            onChange={(e) => setAiBrandQuery(e.target.value)}
            placeholder={t('aiVisibility.brand.brandPlaceholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="w-full md:w-64 relative">
          <input
            type="text"
            aria-label={t('aiVisibility.brand.domainLabel')}
            value={aiBrandDomain}
            onChange={(e) => setAiBrandDomain(e.target.value)}
            placeholder={t('aiVisibility.brand.domainPlaceholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <div className="grid w-full gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs text-slate-300">{t('aiResearch.prompts')}
            <textarea aria-label={t('aiResearch.prompts')} rows={4} value={prompts} onChange={(event) => setPrompts(event.target.value)} onBlur={() => setResearchSettings({ prompts: prompts.split(/\n/) })} placeholder={t('aiResearch.promptsPlaceholder')} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
          </label>
          <label className="grid gap-1 text-xs text-slate-300">{t('aiResearch.competitors')}
            <textarea aria-label={t('aiResearch.competitors')} rows={4} value={competitors} onChange={(event) => setCompetitors(event.target.value)} onBlur={() => setResearchSettings({ competitors: competitors.split(/\n/) })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
          </label>
          <label className="flex items-center gap-3 text-xs text-slate-300">{t('aiResearch.repetitions')}
            <input aria-label={t('aiResearch.repetitions')} type="number" min={1} max={5} value={researchSettings.repetitions} onChange={(event) => setResearchSettings({ repetitions: Number(event.target.value) })} className="w-20 rounded border border-slate-700 bg-slate-950 p-2" />
          </label>
          <p className="text-xs text-slate-400">{t('aiResearch.methodologyNote')}</p>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('aiVisibility.brand.queryLoading')}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{t('aiVisibility.brand.analyze')}</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {aiBrandReport && (
        <div className="space-y-8">
          {aiBrandHistory.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <label htmlFor="ai-brand-history" className="text-xs text-slate-300">{t('aiVisibility.brand.historyLabel')}</label>
              <select id="ai-brand-history" aria-label={t('aiVisibility.brand.historyAria')} value={aiBrandReport.timestamp} onChange={(event) => selectAiBrandReport(event.target.value)} className="min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                {aiBrandHistory.map((report) => <option key={report.timestamp} value={report.timestamp}>{new Date(report.timestamp).toLocaleString()} · {report.brand}{report.domain ? ` (${report.domain})` : ''}</option>)}
              </select>
              <span className="text-[10px] text-slate-500">{t('aiVisibility.brand.historyNote')}</span>
            </div>
          )}
          {aiBrandReport.models.length === 0 && <p className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">{t('aiVisibility.brand.noClients')}</p>}
          {/* Top Overview & Takeaways */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
                  {t(aiBrandReport.methodology ? 'aiVisibility.brand.mentionRate' : 'aiResearch.legacyRecognition')}
                </span>
                <div className="text-5xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
                  {!aiBrandReport.methodology || aiBrandReport.overall_score === null ? '—' : `${aiBrandReport.overall_score}%`}
                  <span className="text-xs font-normal text-emerald-400">{t('aiVisibility.brand.sample')}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {t(aiBrandReport.methodology ? 'aiResearch.scoreDescription' : 'aiResearch.legacyNote')}
                  {aiBrandReport.methodology && <span className="block mt-2">{t('aiResearch.shareOfVoice', { value: aiBrandReport.share_of_voice == null ? '—' : `${aiBrandReport.share_of_voice}%` })}</span>}
                </p>
              </div>

              <div className="text-[11px] font-mono text-slate-500 pt-3 border-t border-slate-800">
                {t('aiVisibility.brand.lastResearch', { date: new Date(aiBrandReport.timestamp).toLocaleString() })}
              </div>
            </div>

            <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>{t('aiVisibility.brand.promptSummary')}</span>
              </h3>

              <div className="space-y-2">
                {aiBrandReport.key_takeaways.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Model by Model Breakdown Cards */}
          <div className="space-y-4">
            <h3 className="font-bold text-white text-base">{t('aiVisibility.brand.savedResponses')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aiBrandReport.models.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between space-y-4 shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <Bot className="w-4 h-4 text-emerald-400" />
                        <span>{m.model_name}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase ${getSentimentBadge(
                          m.sentiment
                        )}`}
                      >
                        {m.response_status === 'error' ? t('aiVisibility.brand.sentimentError') : m.sentiment === 'not_assessed' ? t('aiVisibility.brand.sentimentNotAssessed') : m.sentiment === 'positive' ? t('aiVisibility.brand.sentimentPositive') : m.sentiment === 'negative' ? t('aiVisibility.brand.sentimentNegative') : t('aiVisibility.brand.sentimentNeutral')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">{t('aiVisibility.brand.brandMentioned')}</span>
                        <span className="text-emerald-400 font-bold">{m.response_status === 'error' ? t('aiVisibility.brand.noResponse') : m.is_present ? t('aiVisibility.brand.mention') : t('aiVisibility.brand.noMention')}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{ width: `${m.response_status === 'error' ? 0 : m.is_present ? 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {m.prompt && <p className="text-xs text-slate-400">{m.prompt} · {t('aiResearch.run', { count: m.repetition })}</p>}
                    {m.search_mode && <p className="text-xs text-slate-400">{t(`aiResearch.${m.search_mode}`)} · {t('aiResearch.position', { value: m.mention_position ?? '—' })} · {t(m.own_domain_cited ? 'aiResearch.ownDomainYes' : 'aiResearch.ownDomainNo')}</p>}
                    {m.competitors_mentioned?.length ? <p className="text-xs text-slate-400">{m.competitors_mentioned.join(', ')}</p> : null}
                    {m.error_message ? <p role="alert" className="text-xs text-rose-200 bg-rose-950/30 p-3 rounded-lg border border-rose-800/40">{m.error_message}</p> : <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">{m.summary}</p>}
                    <p className="text-[10px] text-slate-600">{t('aiVisibility.brand.savedResponse', { date: new Date(m.captured_at).toLocaleString(), provider: m.provider })}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                      {t('aiVisibility.brand.urlsLabel')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {m.cited_sources.map((src, i) => (
                        <a href={src} target="_blank" rel="noreferrer"
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700/80"
                        >
                          {src}
                        </a>
                      ))}
                      {!m.cited_sources.length && <span className="text-[10px] text-slate-600">{t('aiVisibility.brand.noUrl')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
