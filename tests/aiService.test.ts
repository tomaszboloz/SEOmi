import { describe, expect, it, vi } from 'vitest';
import { AIService, extractJsonObject, parseAiSuggestionResponse } from '@/services/ai';

const cliInvoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: cliInvoke }));

const valid = {
  suggestedTitle: 'A useful title',
  suggestedDescription: 'A useful description',
  keyImprovements: ['Improve headings'],
  schemaJsonLd: { '@type': 'WebPage' },
};

describe('AI suggestion response parsing', () => {
  it('extracts fenced JSON without losing braces inside quoted values', () => {
    const response = `Here is the result:\n\n\`\`\`json\n${JSON.stringify({
      ...valid,
      suggestedDescription: 'Use {primary} intent and keep it clear.',
    })}\n\`\`\`\nDone.`;

    expect(parseAiSuggestionResponse(response)).toEqual({
      ...valid,
      suggestedDescription: 'Use {primary} intent and keep it clear.',
    });
  });

  it('selects the first complete valid object from explanatory CLI output', () => {
    const response = `The answer follows: ${JSON.stringify(valid)}\nAdditional notes: {not JSON}`;
    expect(extractJsonObject(response)).toBe(JSON.stringify(valid));
  });

  it('rejects a syntactically valid object with missing required fields', () => {
    expect(() => parseAiSuggestionResponse('{"suggestedTitle":"Only title"}')).toThrow(
      'missing the required suggestion fields',
    );
  });

  it('rejects responses without a JSON object', () => {
    expect(() => parseAiSuggestionResponse('No structured response was returned.')).toThrow(
      'no valid JSON object',
    );
  });

  it('encodes a persisted Gemini model before placing it in the request path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'safe response' }] } }] }),
    } as Response);

    await expect(AIService.generateText('gemini', 'test-key', 'model/name?variant=1', 'prompt')).resolves.toBe('safe response');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('models/model%2Fname%3Fvariant%3D1:generateContent');
    fetchMock.mockRestore();
  });
});


describe('local CLI connection authentication contract', () => {
  it.each(['openai', 'claude', 'gemini'] as const)('tests %s authentication through the native connection command', async (provider) => {
    cliInvoke.mockReset().mockResolvedValue({ provider, available: true, detail: 'authenticated' });
    expect((await AIService.testCliConnection(provider)).success).toBe(true);
    expect(cliInvoke.mock.calls).toEqual([['test_ai_cli_connection', { provider }]]);
  });

  it('preserves a logged-out result instead of treating CLI installation as a connection', async () => {
    cliInvoke.mockResolvedValue({ provider: 'claude', available: false, detail: 'Sign in first' });
    expect(await AIService.testCliConnection('claude')).toEqual({ success: false, message: 'Sign in first' });
  });

  it.each([new Error('authentication timeout'), 'unsupported isolation flags'])('returns native failures without marking the provider connected', async (failure) => {
    cliInvoke.mockRejectedValue(failure);
    expect(await AIService.testCliConnection('openai')).toEqual({ success: false, message: failure instanceof Error ? failure.message : failure });
  });

  it('fails closed when the native status is absent', async () => {
    cliInvoke.mockResolvedValue(undefined);
    expect((await AIService.testCliConnection('gemini')).success).toBe(false);
  });
});
