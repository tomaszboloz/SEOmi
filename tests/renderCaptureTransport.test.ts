import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync('src-tauri/src/commands/render_capture_transport.js', 'utf8');
const loadTransport = (send: (url: string) => void) => new Function('window', 'location', `${source}; return sendCaptureChunks;`)(window, { set href(value: string) { send(value); } }) as (encoded: string, nonce: string, sequence: number, size: number, max: number) => Promise<void>;
const ack = (url: string, override: Record<string, unknown> = {}) => {
  const parsed = new URL(url);
  const [sequence, index] = parsed.pathname.slice(1).split('/').map(Number);
  window.dispatchEvent(new CustomEvent('seomi-capture-ack', { detail: { nonce: parsed.hostname, sequence, index, ...override } }));
};

describe('browser capture acknowledged transport', () => {
  afterEach(() => vi.useRealTimers());

  it('does not send the next fragment until the receiver acknowledges the current one', async () => {
    const sent: string[] = [];
    const transfer = loadTransport((url) => sent.push(url))('abcdef', 'token', 7, 2, 10);
    expect(sent).toHaveLength(1);
    ack(sent[0], { nonce: 'wrong' });
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    ack(sent[0]);
    await Promise.resolve();
    expect(sent).toHaveLength(2);
    ack(sent[1]);
    await Promise.resolve();
    ack(sent[2]);
    await transfer;
    expect(sent.map((url) => new URL(url).searchParams.get('data'))).toEqual(['ab', 'cd', 'ef']);
  });

  it('retries a dropped navigation without losing or reordering any fragment', async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const transfer = loadTransport((url) => {
      sent.push(url);
      if (sent.length > 1) queueMicrotask(() => ack(url));
    })('abcdef', 'token', 2, 2, 10);
    await vi.advanceTimersByTimeAsync(100);
    await transfer;
    expect(sent).toHaveLength(4);
    expect(sent[0]).toBe(sent[1]);
    expect(sent.slice(1).map((url) => new URL(url).searchParams.get('data'))).toEqual(['ab', 'cd', 'ef']);
  });

  it('fails within 500ms when no receiver acknowledges instead of waiting a minute', async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const transfer = loadTransport(send)('abc', 'token', 1, 2, 10);
    const rejected = expect(transfer).rejects.toThrow('not acknowledged');
    await vi.advanceTimersByTimeAsync(500);
    await rejected;
    expect(send).toHaveBeenCalledTimes(5);
    expect(vi.getTimerCount()).toBe(0);
  });
});
