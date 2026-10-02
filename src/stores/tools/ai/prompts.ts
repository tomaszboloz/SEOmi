import { AiPromptComparison } from '@/types';
import { aiSearchMode, analyzeAiEvidence, redactLocalContext } from '@/services/aiResearchEvidence';
import i18n from '@/i18n';
import { parseAiResearchInputs } from '@/services/researchContracts';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { activeProjectId, aiPromptComparisonKey, aiResearchInputsKey, aiPromptSelectionKey } from '../storageKeys';
import { localSubscriptionProviders, beginToolRequest, isLatestToolRequest } from '../runtime';
import { saveProjectResearch, readProjectResearch } from '../researchPersistence';

export const createAiPromptsActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setAiSearchPrompt" | "runAiPromptComparison" | "selectAiPromptComparison"> => ({
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
