import { describe, expect, it, vi } from 'vitest';
import { createOllamaOcrProvider, MAX_OCR_IMAGE_BYTES, ocrLines, resolveModelProvider } from '@/services/multimodal';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const input = (bytes = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })) => ({ url: 'https://a.test/i.png', bytes, contentHash: 'abc' });
const live = () => new AbortController().signal;

describe('optional Ollama vision OCR provider (#96 GEM-96-05/08)', () => {
  it('sends the image only to the configured origin and returns partial whole-image lines', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ response: '1. Dawka 5 mg\n- Druga linia\n\nNONE' }));
    const provider = createOllamaOcrProvider({ model: 'llava', fetchImpl, now: () => 'T' });
    const result = await provider.analyze(input(), live());
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/generate');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ model: 'llava', images: ['iVBORw=='], stream: false });
    expect(result.map((r) => r.text)).toEqual(['Dawka 5 mg', 'Druga linia']);
    expect(result[0]).toMatchObject({ bbox: [0, 0, 1, 1], provenance: { provider: 'ollama-vision', model: 'llava', confidence: null, contentHash: 'abc', analyzedAt: 'T' } });
    expect(resolveModelProvider('ocr', { ocr: provider })).toBe(provider);
    expect(resolveModelProvider('ocr')).toBeNull();
  });

  it('rejects a missing model, oversize or non-image input and cancellation', async () => {
    expect(() => createOllamaOcrProvider({ model: ' ' })).toThrow('model name');
    const fetchImpl = vi.fn().mockResolvedValue(json({ response: 'x' }));
    const provider = createOllamaOcrProvider({ model: 'llava', fetchImpl });
    await expect(provider.analyze(input(new Blob([new Uint8Array(MAX_OCR_IMAGE_BYTES + 1)], { type: 'image/png' })), live())).rejects.toThrow('too large');
    await expect(provider.analyze(input(new Blob(['<html>'], { type: 'text/html' })), live())).rejects.toThrow('Not an image');
    const aborted = new AbortController();
    aborted.abort();
    await expect(provider.analyze(input(), aborted.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces offline Ollama, missing text and cancellation during the request', async () => {
    const offline = createOllamaOcrProvider({ model: 'llava', fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')) });
    await expect(offline.analyze(input(), live())).rejects.toThrow('Cannot reach Ollama');
    const empty = createOllamaOcrProvider({ model: 'llava', fetchImpl: vi.fn().mockResolvedValue(json({ done: true })) });
    await expect(empty.analyze(input(), live())).rejects.toThrow('no text');
    const controller = new AbortController();
    const late = createOllamaOcrProvider({ model: 'llava', fetchImpl: vi.fn().mockImplementation(async () => { controller.abort(); return json({ response: 'x' }); }) });
    await expect(late.analyze(input(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('bounds and cleans reply lines', () => {
    expect(ocrLines('none')).toEqual([]);
    expect(ocrLines(`${'a'.repeat(600)}\n* b`)).toEqual(['a'.repeat(500), 'b']);
    expect(ocrLines(Array.from({ length: 300 }, (_, i) => `l${i}`).join('\n'))).toHaveLength(200);
  });
});
