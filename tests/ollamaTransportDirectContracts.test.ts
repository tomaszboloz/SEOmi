import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOllama,
  ollamaBaseUrl,
  ollamaSettings,
  postOllama,
} from '@/services/embeddings/ollamaTransport';

describe('ollama transport direct url and get contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates baseUrl origin constraints strictly', () => {
    expect(ollamaBaseUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
    expect(ollamaBaseUrl('https://ollama.internal:8443')).toBe('https://ollama.internal:8443');
    expect(() => ollamaBaseUrl('ftp://127.0.0.1')).toThrow('Ollama URL must use http or https');
    expect(() => ollamaBaseUrl('http://user:pass@127.0.0.1:11434')).toThrow('Ollama URL must not contain credentials');
    expect(() => ollamaBaseUrl('http://127.0.0.1:11434/subpath')).toThrow('origin without path');
    expect(() => ollamaBaseUrl('http://127.0.0.1:11434?query=1')).toThrow('origin without path');
    expect(() => ollamaBaseUrl('http://127.0.0.1:11434#hash')).toThrow('origin without path');
  });

  it('performs getOllama with GET method and Accept json header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'nomic-embed-text' }] })),
    );
    const settings = ollamaSettings({ fetchImpl });
    const result = await getOllama(settings, '/api/tags');
    expect(result).toEqual({ models: [{ name: 'nomic-embed-text' }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/tags');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toEqual({ Accept: 'application/json' });
  });

  it('handles getOllama HTTP errors, unreachable host, and non-object JSON', async () => {
    const fetchHttpError = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    const settingsHttp = ollamaSettings({ fetchImpl: fetchHttpError });
    await expect(getOllama(settingsHttp, '/api/tags')).rejects.toThrow('Ollama /api/tags returned HTTP 404');

    const fetchNetworkError = vi.fn().mockRejectedValue(new Error('connection refused'));
    const settingsNet = ollamaSettings({ fetchImpl: fetchNetworkError });
    await expect(getOllama(settingsNet, '/api/tags')).rejects.toThrow('Cannot reach Ollama at');

    const fetchArrayJson = vi.fn().mockResolvedValue(new Response('[]'));
    const settingsArray = ollamaSettings({ fetchImpl: fetchArrayJson });
    await expect(getOllama(settingsArray, '/api/tags')).rejects.toThrow('Ollama returned an invalid response');

    const fetchNullBody = vi.fn().mockResolvedValue(new Response(null));
    const settingsNull = ollamaSettings({ fetchImpl: fetchNullBody });
    await expect(getOllama(settingsNull, '/api/tags')).rejects.toThrow('Ollama returned an invalid response');
  });

  it('handles postOllama HTTP error and array response payload', async () => {
    const fetchError = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    const settings = ollamaSettings({ fetchImpl: fetchError });
    await expect(postOllama(settings, '/api/generate', {})).rejects.toThrow('Ollama /api/generate returned HTTP 500');

    const fetchArray = vi.fn().mockResolvedValue(new Response('["invalid"]'));
    const settingsArr = ollamaSettings({ fetchImpl: fetchArray });
    await expect(postOllama(settingsArr, '/api/generate', {})).rejects.toThrow('Ollama returned an invalid response');
  });
});
