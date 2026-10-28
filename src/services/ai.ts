import type { AiConnectionMethod, AiProvider, PageAuditData } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import { executeWithEconomy, LlmFactGateBlockedError } from '@/services/llmEconomy';
import type { YmylSourceInput } from '@/services/llmEconomy';
import i18n from '@/i18n';
import { parseAiSuggestionResponse, type AiSuggestionResponse } from './ai/parsing';
import { buildAiPrompt } from './ai/prompt';
import { callOpenAI, callClaude, callGemini } from './ai/suggestions';
import { generateAiText } from './ai/text';
import { testAiConnection } from './ai/connection';
import { CLAUDE_DEFAULT_MODEL } from './ai/claude';
import { GEMINI_DEFAULT_MODEL, currentModel } from './ai/modelCatalog';
export { extractJsonObject, parseAiSuggestionResponse } from './ai/parsing';
export type { AiSuggestionResponse } from './ai/parsing';

export interface GenerateTextEconomyOptions {
  projectId?: string | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  vector?: ArrayLike<number> | null;
  ymyl?: boolean;
  sources?: YmylSourceInput[];
}

export interface GenerateSuggestionsEconomyOptions {
  projectId?: string | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  vector?: ArrayLike<number> | null;
  ymyl?: boolean;
  sources?: YmylSourceInput[];
}

export class AIService {
  static generateText(
    provider: AiProvider,
    apiKey: string,
    model: string,
    prompt: string,
    method: AiConnectionMethod = 'api_key',
    options?: GenerateTextEconomyOptions,
  ): Promise<string> {
    const projectId = options?.projectId ?? null;
    if (!projectId?.trim()) return Promise.reject(new Error('Project ID is required for economy-scoped AI generation'));
    return executeWithEconomy({
        projectId,
        configuredProviders: [provider],
        providerId: provider,
        transport: 'cloud',
        model,
        prompt,
        vector: options?.vector,
        estimatedCostUsd: options?.estimatedCostUsd,
        actualCostUsd: options?.actualCostUsd,
        ymyl: options?.ymyl,
        sources: options?.sources,
        run: async () => ({ text: await generateAiText(provider, apiKey, model, prompt, method), transport: 'cloud' }),
    }).then((res) => {
      if (options?.ymyl && !res.factGatePassed) throw new LlmFactGateBlockedError(res.rejectedClaims);
      return res.text;
    });
  }
static async generateSuggestions(
  provider: AiProvider,
  apiKey: string,
  model: string,
  auditData: PageAuditData,
  customInstruction?: string,
  method: AiConnectionMethod = 'api_key',
  options?: GenerateSuggestionsEconomyOptions,
): Promise<AiSuggestionResponse> {
  const prompt = buildAiPrompt(auditData, customInstruction);
  const projectId = options?.projectId ?? null;
  if (!projectId?.trim()) throw new Error('Project ID is required for economy-scoped AI generation');
  return executeWithEconomy({
      projectId, configuredProviders: [provider], providerId: provider, transport: 'cloud', model, prompt,
      vector: options?.vector, estimatedCostUsd: options?.estimatedCostUsd,
      actualCostUsd: options?.actualCostUsd, ymyl: options?.ymyl, sources: options?.sources,
      run: async () => ({ text: await generateSuggestionsDirect(provider, apiKey, model, auditData, customInstruction, method), transport: 'cloud' }),
  }).then((result) => {
    if (options?.ymyl && !result.factGatePassed) throw new LlmFactGateBlockedError(result.rejectedClaims);
    return parseAiSuggestionResponse(result.text);
  });
}

  static testConnection(provider:AiProvider,apiKey:string):Promise<{success:boolean;message:string}> {
    return testAiConnection(provider,apiKey);
  }
  static async testCliConnection(provider: AiProvider): Promise<{ success: boolean; message: string }> {
    try {
      const status = await invokeTauriCommand<{ provider: AiProvider; available: boolean; detail: string }>('test_ai_cli_connection', { provider });
      return status?.available
        ? { success: true, message: i18n.t('runtimeErrors.ai.cliAvailable', { provider: status.provider, detail: status.detail }) }
        : { success: false, message: status?.detail || i18n.t('runtimeErrors.ai.cliMissing') };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}

const generateSuggestionsDirect = async (
  provider: AiProvider,
  apiKey: string,
  model: string,
  auditData: PageAuditData,
  customInstruction?: string,
  method: AiConnectionMethod = 'api_key',
): Promise<string> => {
  if (method === 'local_cli') {
    return invokeTauriCommand<string>('run_ai_cli', { provider, prompt: buildAiPrompt(auditData, customInstruction) });
  }
  if (!apiKey.trim()) throw new Error(i18n.t('runtimeErrors.ai.configureKey'));
  const prompt = buildAiPrompt(auditData, customInstruction);
  switch (provider) {
    case 'openai': return JSON.stringify(await callOpenAI(apiKey, model || 'gpt-4o', prompt));
    case 'claude': return JSON.stringify(await callClaude(apiKey, model || CLAUDE_DEFAULT_MODEL, prompt));
    case 'gemini': return JSON.stringify(await callGemini(apiKey, currentModel(model || GEMINI_DEFAULT_MODEL), prompt));
    default: throw new Error(i18n.t('runtimeErrors.ai.unsupportedProvider', { provider }));
  }
};
