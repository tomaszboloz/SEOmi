import { beforeEach, describe, expect, it } from 'vitest';
import {
  OLLAMA_ASSISTANT_BASE_URL,
  OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS,
  OLLAMA_ASSISTANT_MAX_OUTPUT_TOKENS,
  ollamaAssistantModelKey,
  ollamaAssistantMaxTokensKey,
  ollamaAssistantInstructionKey,
  readOllamaAssistantInstruction,
  readOllamaAssistantModel,
  readOllamaAssistantMaxTokens,
  saveOllamaAssistantModel,
  saveOllamaAssistantMaxTokens,
  saveOllamaAssistantInstruction,
} from '@/components/AI/ollama/ollamaAssistantStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('ollamaAssistantStorage direct assertions', () => {
  it('exports valid constants', () => {
    expect(OLLAMA_ASSISTANT_BASE_URL).toBe('http://127.0.0.1:11434');
    expect(OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS).toBe(2048);
    expect(OLLAMA_ASSISTANT_MAX_OUTPUT_TOKENS).toBe(4096);
  });

  it('generates versioned and encoded storage keys', () => {
    expect(ollamaAssistantModelKey('proj-1'))
      .toBe('seomi_project_proj-1_ollama_assistant_model_v1');
    expect(ollamaAssistantMaxTokensKey('special/proj'))
      .toBe('seomi_project_special%2Fproj_ollama_assistant_max_output_tokens_v1');
    expect(ollamaAssistantInstructionKey('special/proj'))
      .toBe('seomi_project_special%2Fproj_ollama_assistant_instruction_v1');
  });

  it('read and save ollama assistant model per project', () => {
    expect(readOllamaAssistantModel('proj-1')).toBe('');
    expect(saveOllamaAssistantModel('proj-1', 'llama3:8b')).toBe(true);
    expect(readOllamaAssistantModel('proj-1')).toBe('llama3:8b');

    // null projectId handling
    expect(saveOllamaAssistantModel(null, 'llama3')).toBe(false);
    expect(readOllamaAssistantModel(null)).toBe('');
  });

  it('read and save ollama assistant max tokens with bounds validation', () => {
    expect(readOllamaAssistantMaxTokens('proj-1'))
      .toBe(OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS);

    expect(saveOllamaAssistantMaxTokens('proj-1', 1024)).toBe(true);
    expect(readOllamaAssistantMaxTokens('proj-1')).toBe(1024);

    // values exceeding max fallback to default
    saveOllamaAssistantMaxTokens('proj-1', 99999);
    expect(readOllamaAssistantMaxTokens('proj-1'))
      .toBe(OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS);

    // null project returns default and cannot save
    expect(readOllamaAssistantMaxTokens(null))
      .toBe(OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS);
    expect(saveOllamaAssistantMaxTokens(null, 1024)).toBe(false);
  });

  it('reads and saves bounded project instructions', () => {
    expect(readOllamaAssistantInstruction('proj-1')).toBe('');
    expect(saveOllamaAssistantInstruction('proj-1', 'Focus on intent')).toBe(true);
    expect(readOllamaAssistantInstruction('proj-1')).toBe('Focus on intent');
    expect(saveOllamaAssistantInstruction('proj-1', 'x'.repeat(2_001))).toBe(false);
    expect(readOllamaAssistantInstruction('proj-1')).toBe('Focus on intent');
    expect(saveOllamaAssistantInstruction(null, 'x')).toBe(false);
  });
});
