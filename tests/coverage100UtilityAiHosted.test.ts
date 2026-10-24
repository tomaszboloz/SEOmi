import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeTauriCommand } from '@/services/tauri';
import { generateAiText } from '@/services/ai/text';
import { callClaude, callGemini, callOpenAI } from '@/services/ai/suggestions';
import { buildAiPrompt } from '@/services/ai/prompt';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
const invoke = vi.mocked(invokeTauriCommand);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const openAiBody = { choices: [{ message: { content: 'answer' } }] };
const claudeBody = { content: [{ type: 'text', text: 'answer' }] };
const geminiBody = { candidates: [{ content: { parts: [{ text: 'answer' }] } }] };

beforeEach(() => {
  invoke.mockReset(); vi.stubGlobal('fetch', vi.fn());
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe('hosted AI generation paths', () => {
  it('uses local CLI transport, validates credentials and parses hosted responses', async () => {
    invoke.mockResolvedValue('cli answer');
    await expect(generateAiText('openai', '', 'ignored', 'prompt', 'local_cli')).resolves.toBe('cli answer');
    expect(invoke).toHaveBeenCalledWith('run_ai_cli', { provider: 'openai', prompt: 'prompt' });
    await expect(generateAiText('openai', ' ', 'model', 'prompt')).rejects.toThrow();
    vi.mocked(fetch).mockResolvedValueOnce(json(openAiBody)).mockResolvedValueOnce(json(claudeBody)).mockResolvedValueOnce(json(geminiBody));
    await expect(generateAiText('openai', 'key', 'gpt-4o', 'prompt')).resolves.toBe('answer');
    await expect(generateAiText('claude', 'key', 'claude-opus-5', 'prompt')).resolves.toBe('answer');
    await expect(generateAiText('gemini', 'key', 'gemini-3.8-flash', 'prompt')).resolves.toBe('answer');
  });

  it('maps hosted suggestion calls and model failures through the bounded response errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(openAiBody)).mockResolvedValueOnce(json(claudeBody)).mockResolvedValueOnce(json(geminiBody));
    const expected = { suggestedTitle: 'Title', suggestedDescription: 'Description', keyImprovements: ['one'] };
    const payload = (body: unknown) => json({ choices: [{ message: { content: JSON.stringify(body) } }] });
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(payload(expected));
    await expect(callOpenAI('key', 'gpt-4o', 'prompt')).resolves.toEqual(expected);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 400 }));
    await expect(callClaude('key', 'claude-opus-5', 'prompt')).rejects.toThrow();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 429 }));
    await expect(callGemini('key', 'gemini', 'prompt')).rejects.toThrow();
  });

  it('builds a prompt with explicit missing-field and custom-instruction markers', () => {
    const prompt = buildAiPrompt({ final_url: 'https://site.test', meta_tags: { title: '', description: '', title_length: 0, description_length: 0 }, headings: { h1_texts: [] }, content_stats: { top_keywords: [] } } as never, 'Prefer a concise answer');
    expect(prompt).toContain('(missing)');
    expect(prompt).toContain('User Specific Instruction: Prefer a concise answer');
  });
});
