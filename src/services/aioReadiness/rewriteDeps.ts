import { createOllamaChat } from '@/services/embeddings/ollamaChat';
import { executeWithEconomy } from '@/services/llmEconomy';
import type { BriefDeps } from '@/services/siteFocusBenchmark/rewriteBrief';
import { OLLAMA_ASSISTANT_BASE_URL, readOllamaAssistantMaxTokens, readOllamaAssistantModel } from '@/components/AI/ollama/ollamaAssistantStorage';

/**
 * Rewrite uses the connected cloud/CLI provider first (shared auth path, no separate keys).
 * Without one, it falls back to the local Ollama model already chosen for the project.
 */
export const withOllamaFallback = (deps: BriefDeps, projectId: string | null | undefined): BriefDeps => {
  if (deps.isConfigured()) return deps;
  const model = projectId ? readOllamaAssistantModel(projectId) : '';
  if (!projectId || !model) return deps;
  const chat = createOllamaChat({ baseUrl: OLLAMA_ASSISTANT_BASE_URL, model, maxOutputTokens: readOllamaAssistantMaxTokens(projectId) });
  // #137: the local model also goes through the economy (project cache, ledger with cost 0, local transport),
  // so repeated rewrites are free and the usage panel counts them like every other AI call.
  const generateText = async (prompt: string): Promise<string> => (await executeWithEconomy({
    projectId, configuredProviders: ['ollama'], providerId: 'ollama', transport: 'local', model, prompt,
    run: async () => ({ text: (await chat([{ role: 'user', content: prompt }])).text, transport: 'local' }),
  })).text;
  return { isConfigured: () => true, generateText };
};
