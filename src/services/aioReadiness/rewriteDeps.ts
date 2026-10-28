import { createOllamaChat } from '@/services/embeddings/ollamaChat';
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
  return { isConfigured: () => true, generateText: async (prompt) => (await chat([{ role: 'user', content: prompt }])).text };
};
