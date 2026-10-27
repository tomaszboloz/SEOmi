import { readStorage, writeStorage } from '@/services/storage';

export const OLLAMA_ASSISTANT_BASE_URL = 'http://127.0.0.1:11434';
export const OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS = 2_048;
export const OLLAMA_ASSISTANT_MAX_OUTPUT_TOKENS = 4_096;
export const OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS = 2_000;
export const OLLAMA_ASSISTANT_MAX_PROMPT_CHARS = 16_000;

const projectKey = (projectId: string, suffix: string): string =>
  `seomi_project_${encodeURIComponent(projectId)}_ollama_assistant_${suffix}_v1`;

export const ollamaAssistantModelKey = (projectId: string): string => projectKey(projectId, 'model');
export const ollamaAssistantMaxTokensKey = (projectId: string): string => projectKey(projectId, 'max_output_tokens');
export const ollamaAssistantInstructionKey = (projectId: string): string => projectKey(projectId, 'instruction');

export const readOllamaAssistantModel = (projectId: string | null): string =>
  projectId ? readStorage(ollamaAssistantModelKey(projectId))?.trim() || '' : '';

export const readOllamaAssistantMaxTokens = (projectId: string | null): number => {
  if (!projectId) return OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = Number.parseInt(readStorage(ollamaAssistantMaxTokensKey(projectId)) || '', 10);
  return Number.isSafeInteger(raw) && raw >= 1 && raw <= OLLAMA_ASSISTANT_MAX_OUTPUT_TOKENS
    ? raw
    : OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS;
};

export const readOllamaAssistantInstruction = (projectId: string | null): string => {
  if (!projectId) return '';
  const value = readStorage(ollamaAssistantInstructionKey(projectId)) || '';
  return value.length <= OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS ? value : '';
};

export const saveOllamaAssistantModel = (projectId: string | null, model: string): boolean => {
  return projectId ? writeStorage(ollamaAssistantModelKey(projectId), model.trim()) : false;
};

export const saveOllamaAssistantMaxTokens = (projectId: string | null, value: number): boolean => {
  return projectId ? writeStorage(ollamaAssistantMaxTokensKey(projectId), String(value)) : false;
};

export const saveOllamaAssistantInstruction = (projectId: string | null, value: string): boolean => {
  return projectId && value.length <= OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS
    ? writeStorage(ollamaAssistantInstructionKey(projectId), value)
    : false;
};
