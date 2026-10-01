
import { BrandAiVisibilityReport, AiPromptComparison } from '@/types';

import { aiSearchMode, analyzeAiEvidence, isUnbrandedPrompt, normalizeAiResearchSettings, redactLocalContext } from '@/services/aiResearchEvidence';

import i18n from '@/i18n';
import { parseAiResearchInputs } from '@/services/researchContracts';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { activeProjectId, aiBrandReportKey, aiPromptComparisonKey, aiResearchInputsKey, aiResearchSettingsKey, aiBrandSelectionKey, aiPromptSelectionKey } from './storageKeys';
import { localSubscriptionProviders, beginToolRequest, isLatestToolRequest, errorMessage } from './runtime';
import { saveProjectResearch, readProjectResearch } from './researchPersistence';

export const createAiSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setAiResearchSettings" | "setAiBrandQuery" | "setAiBrandDomain" | "analyzeAiBrandVisibility" | "selectAiBrandReport" | "setAiSearchPrompt" | "runAiPromptComparison" | "selectAiPromptComparison"> => ({
setAiResearchSettings: (settings) => {
    const next = normalizeAiResearchSettings({ ...get().aiResearchSettings, ...settings });
    set({ aiResearchSettings: next });
    saveProjectResearch(aiResearchSettingsKey, next);
  },
setAiBrandQuery: (brand) => {
    set({ aiBrandQuery: brand });
    const projectId = activeProjectId();
    if (projectId) saveProjectResearch(aiResearchInputsKey, { ...parseAiResearchInputs(readProjectResearch(aiResearchInputsKey, projectId)), brand, domain: get().aiBrandDomain, prompt: get().aiSearchPrompt }, projectId);
  },
setAiBrandDomain: (domain) => {
    set({ aiBrandDomain: domain });
    const projectId = activeProjectId();
    if (projectId) saveProjectResearch(aiResearchInputsKey, { ...parseAiResearchInputs(readProjectResearch(aiResearchInputsKey, projectId)), brand: get().aiBrandQuery, domain, prompt: get().aiSearchPrompt }, projectId);
  },
analyzeAiBrandVisibility: async (brand, domain) => {
    const b = (brand ?? get().aiBrandQuery).trim();
    const d = (domain ?? get().aiBrandDomain).trim();
    if (!b) return;
    const projectId = activeProjectId();
    if (!projectId) return set({ aiBrandError: i18n.t('runtimeErrors.tools.aiProject') });
    const requestToken = beginToolRequest('ai-brand');
    set({ isAiBrandLoading: true, aiBrandError: null });
    try {
      const providers = await localSubscriptionProviders();
      if (activeProjectId() !== projectId || !isLatestToolRequest('ai-brand', requestToken)) return;
      if (!providers.length) throw new Error(i18n.t('runtimeErrors.tools.aiConnect'));
      const settings = normalizeAiResearchSettings(get().aiResearchSettings);
      if (!settings.prompts.length) throw new Error(i18n.t('aiResearch.promptsRequired'));
      if (settings.prompts.some((prompt) => !isUnbrandedPrompt(prompt, b, d))) throw new Error(i18n.t('aiResearch.unbrandedRequired'));
      const observations = [];
      // Bound fan-out and retain the exact prompt/repetition for every observation.
      for (const prompt of settings.prompts) {
        for (let repetition = 1; repetition <= settings.repetitions; repetition += 1) {
          if (activeProjectId() !== projectId || !isLatestToolRequest('ai-brand', requestToken)) return;
          const batch = await Promise.all(providers.map(async (provider) => {
            const capturedAt = new Date().toISOString();
            const base = { provider, capturedAt, prompt, repetition, searchMode: aiSearchMode(provider) };
            try {
              const raw = await services.generateText(provider, `${prompt}\n\nAnswer impartially. If uncertain, say so. Include source URLs exactly; do not invent citations.`);
              const response = redactLocalContext(raw);
              const evidence = analyzeAiEvidence(response, b, d, settings.competitors, prompt);
              return { ...base, response, present: evidence.brandMentioned, evidence, error: undefined as string | undefined };
            } catch (error) {
              return { ...base, response: '', present: false, evidence: analyzeAiEvidence('', b, d, settings.competitors), error: redactLocalContext(errorMessage(error, i18n.t('runtimeErrors.tools.aiNoResponse'))) };
            }
          }));
          observations.push(...batch);
        }
      }
      const query = settings.prompts.join('\n');
      const successful = observations.filter((item) => !item.error);
      const mentioned = successful.filter((item) => item.present).length;
      const capturedAt = new Date().toISOString();
      const report: BrandAiVisibilityReport = {
        brand: b, domain: d, overall_score: successful.length ? Math.round(mentioned / successful.length * 100) : null, query_checked: query, timestamp: capturedAt,
        methodology: 'unbranded_prompts', prompts: settings.prompts, repetitions: settings.repetitions, competitors: settings.competitors,
        share_of_voice: successful.reduce((sum, item) => sum + item.evidence.competitorsMentioned.length + Number(item.present), 0) ? Math.round(100 * mentioned / successful.reduce((sum, item) => sum + item.evidence.competitorsMentioned.length + Number(item.present), 0)) : null,
        key_takeaways: successful.length ? [i18n.t('runtimeErrors.tools.aiTakeaway', { mentioned, successful: successful.length }), i18n.t('aiResearch.methodologyNote')] : [i18n.t('runtimeErrors.tools.aiNoResponse')],
        models: observations.map((item) => ({
          model_name: i18n.t('runtimeErrors.tools.aiProviderModel', { provider: item.provider }), model_id: null, provider: item.provider, connection_method: 'local_cli', captured_at: item.capturedAt,
          is_present: item.present, visibility_percentage: item.error ? 0 : item.present ? 100 : 0, sentiment: 'not_assessed',
          summary: item.error ? '' : item.response, cited_sources: item.evidence.citations, prompt: item.prompt, repetition: item.repetition, search_mode: item.searchMode, mention_position: item.evidence.mentionPosition, own_domain_cited: item.evidence.ownDomainCited, competitors_mentioned: item.evidence.competitorsMentioned, response_status: item.error ? 'error' : 'success', ...(item.error ? { error_message: item.error } : {}),
        })),
      };
      if (activeProjectId() !== projectId || !isLatestToolRequest('ai-brand', requestToken)) return;
      const history = [report, ...get().aiBrandHistory.filter((item) => item.timestamp !== report.timestamp)].slice(0, 50);
      set({ aiBrandQuery: b, aiBrandDomain: d, aiBrandReport: report, aiBrandHistory: history, isAiBrandLoading: false });
      saveProjectResearch(aiBrandReportKey, history, projectId);
      saveProjectResearch(aiBrandSelectionKey, report.timestamp, projectId);
      saveProjectResearch(aiResearchInputsKey, { ...parseAiResearchInputs(readProjectResearch(aiResearchInputsKey, projectId)), brand: b, domain: d, prompt: get().aiSearchPrompt }, projectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.aiNoResponse');
      if (activeProjectId() === projectId && isLatestToolRequest('ai-brand', requestToken)) set({ aiBrandError: msg, isAiBrandLoading: false });
    }
  },
selectAiBrandReport: (timestamp) => {
    const report = get().aiBrandHistory.find((item) => item.timestamp === timestamp);
    if (report) {
      set({ aiBrandReport: report, aiBrandQuery: report.brand, aiBrandDomain: report.domain });
      saveProjectResearch(aiBrandSelectionKey, report.timestamp);
    }
  },
setAiSearchPrompt: (p) => {
    set({ aiSearchPrompt: p });
    const projectId = activeProjectId();
    if (projectId) saveProjectResearch(aiResearchInputsKey, { ...parseAiResearchInputs(readProjectResearch(aiResearchInputsKey, projectId)), brand: get().aiBrandQuery, domain: get().aiBrandDomain, prompt: p }, projectId);
  },
runAiPromptComparison: async (prompt) => {
    const p = (prompt ?? get().aiSearchPrompt).trim();
    if (!p) return;

    const projectId = activeProjectId();
    if (!projectId) return set({ aiPromptError: i18n.t('runtimeErrors.tools.projectRequired') });
    const researchBrand = get().aiBrandQuery;
    const researchDomain = get().aiBrandDomain;
    const researchCompetitors = [...get().aiResearchSettings.competitors];
    const requestToken = beginToolRequest('ai-prompt');
    set({ isAiPromptLoading: true, aiPromptError: null });
    try {
      const providers = await localSubscriptionProviders();
      if (activeProjectId() !== projectId || !isLatestToolRequest('ai-prompt', requestToken)) return;
      if (!providers.length) throw new Error(i18n.t('runtimeErrors.tools.aiConnect'));
      const query = `${p}\n\nWhen you provide source URLs, reproduce them exactly. Do not invent citations or imply that URLs have been independently verified.`;
      const results = await Promise.all(providers.map(async (provider) => {
        const capturedAt = new Date().toISOString();
        try {
          const responseText = redactLocalContext(await services.generateText(provider, query));
          const evidence = analyzeAiEvidence(responseText, researchBrand, researchDomain, researchCompetitors, p);
          return { provider, capturedAt, responseText, evidence, error: undefined as string | undefined };
        } catch (error) {
          return { provider, capturedAt, responseText: '', evidence: analyzeAiEvidence('', '', '', []), error: redactLocalContext(error instanceof Error ? error.message : String(error)) };
        }
      }));
      const comparison: AiPromptComparison = {
        prompt: p, captured_at: new Date().toISOString(),
        results: results.map((item) => ({
          provider: item.provider, connection_method: 'local_cli', captured_at: item.capturedAt,
          model_name: i18n.t('runtimeErrors.tools.aiProviderModel', { provider: item.provider }), response_text: item.responseText, brand_mentions: item.evidence.brandMentions, citations: item.evidence.citations, own_domain_cited: item.evidence.ownDomainCited, mention_position: item.evidence.mentionPosition, search_mode: aiSearchMode(item.provider),
          response_status: item.error ? 'error' : 'success', ...(item.error ? { error_message: item.error } : {}),
        })),
      };
      if (activeProjectId() !== projectId || !isLatestToolRequest('ai-prompt', requestToken)) return;
      const history = [comparison, ...get().aiPromptHistory.filter((item) => item.captured_at !== comparison.captured_at)].slice(0, 50);
      set({ aiSearchPrompt: p, aiPromptComparison: comparison, aiPromptHistory: history, isAiPromptLoading: false });
      saveProjectResearch(aiPromptComparisonKey, history, projectId);
      saveProjectResearch(aiPromptSelectionKey, comparison.captured_at, projectId);
      saveProjectResearch(aiResearchInputsKey, { ...parseAiResearchInputs(readProjectResearch(aiResearchInputsKey, projectId)), brand: get().aiBrandQuery, domain: get().aiBrandDomain, prompt: p }, projectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : i18n.t('runtimeErrors.tools.comparisonFailed');
      if (activeProjectId() === projectId && isLatestToolRequest('ai-prompt', requestToken)) set({ aiPromptError: msg, isAiPromptLoading: false });
    }
  },
selectAiPromptComparison: (capturedAt) => {
    const comparison = get().aiPromptHistory.find((item) => item.captured_at === capturedAt);
    if (comparison) {
      set({ aiPromptComparison: comparison, aiSearchPrompt: comparison.prompt });
      saveProjectResearch(aiPromptSelectionKey, comparison.captured_at);
    }
  }
});
