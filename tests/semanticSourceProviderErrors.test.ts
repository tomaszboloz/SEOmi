import { describe, expect, it } from 'vitest';
import { classifyProviderError, redactSecrets, withTimeout } from '@/services/semanticSource';

describe('provider failures and secret redaction (#86 GEM-86-08, T01, T05)', () => {
  it('redacts keys, bearer tokens, URL credentials and secret parameters', () => {
    const text = [
      'key sk-proj-abcdefghijklmnop123', 'google AIzaSyA1234567890abcdefghijklmn', 'Authorization: Bearer abc.def.ghi123',
      'https://user:hunter2@api.example.com/x', 'https://api.example.com/q?api_key=SECRET1&q=seo', '{"password":"p4ss"}',
    ].join(' ');
    const clean = redactSecrets(text);
    ['abcdefghijklmnop123', 'AIzaSyA', 'abc.def.ghi123', 'hunter2', 'SECRET1', 'p4ss'].forEach((secret) => expect(clean).not.toContain(secret));
    expect(clean).toContain('q=seo');
    expect(redactSecrets('plain text')).toBe('plain text');
  });

  it.each([
    [Object.assign(new Error('x'), { name: 'AbortError' }), 'cancelled'],
    [Object.assign(new Error('slow'), { name: 'TimeoutError' }), 'timeout'],
    [new Error('HTTP 429 Too Many Requests'), 'rate-limited'],
    [new Error('model "nomic" not found, try pulling it first'), 'model-missing'],
    [new Error('Cannot reach Ollama at http://127.0.0.1:11434. Start it with "ollama serve" and pull the model'), 'offline'],
    [new Error('Ollama /api/embed returned HTTP 404'), 'model-missing'],
    [new Error('Ollama returned embeddings of different sizes'), 'invalid-response'],
    ['weird', 'failed'],
    [42, 'failed'],
  ])('classifies %s', (error, code) => {
    expect(classifyProviderError(error).code).toBe(code);
  });

  it('redacts and bounds the reported message', () => {
    const result = classifyProviderError(new Error(`failed with token=abc123 ${'x'.repeat(400)}`));
    expect(result.message).toContain('token=[redacted]');
    expect(result.message.length).toBeLessThanOrEqual(300);
  });

  it('times out, cancels and passes results through', async () => {
    await expect(withTimeout(Promise.resolve(1), undefined)).resolves.toBe(1);
    await expect(withTimeout(Promise.resolve(2), 50)).resolves.toBe(2);
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
    await expect(withTimeout(new Promise(() => undefined), 5)).rejects.toMatchObject({ name: 'TimeoutError' });
    const controller = new AbortController();
    const pending = withTimeout(new Promise(() => undefined), undefined, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
