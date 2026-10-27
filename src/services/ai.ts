import type { AiConnectionMethod, AiProvider, PageAuditData } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import { executeWithEconomy } from '@/services/llmEconomy';
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
  sources?: string[];
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
    if (projectId) {
      return executeWithEconomy({
        projectId,
        configuredProviders: [provider],
        providerId: provider,
        model,
        prompt,
        vector: options?.vector,
        estimatedCostUsd: options?.estimatedCostUsd,
        actualCostUsd: options?.actualCostUsd,
        ymyl: options?.ymyl,
        sources: options?.sources,
        run: async () => ({ text: await generateAiText(provider, apiKey, model, prompt, method) }),
      }).then((res) => res.text);
    }
    return generateAiText(provider, apiKey, model, prompt, method);
  }
static async generateSuggestions(
  provider: AiProvider,
  apiKey: string,
  model: string,
  auditData: PageAuditData,
  customInstruction?: string,
  method: AiConnectionMethod = 'api_key',
): Promise<AiSuggestionResponse> {
  if (method === 'local_cli') {
    const text = await invokeTauriCommand<string>('run_ai_cli', { provider, prompt: buildAiPrompt(auditData, customInstruction) });
    return parseAiSuggestionResponse(text);
  }
  if (!apiKey.trim()) {
    throw new Error(i18n.t('runtimeErrors.ai.configureKey'));
  }

  const prompt = buildAiPrompt(auditData, customInstruction);

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model || 'gpt-4o', prompt);
    case 'claude':
      return callClaude(apiKey, model || CLAUDE_DEFAULT_MODEL, prompt);
    case 'gemini':
      return callGemini(apiKey, currentModel(model || GEMINI_DEFAULT_MODEL), prompt);
    default:
      throw new Error(i18n.t('runtimeErrors.ai.unsupportedProvider', { provider }));
  }
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
