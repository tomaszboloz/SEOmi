// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runAiBrief, type BriefCache } from '@/services/aiBriefRunner';

const deps = (generate: (prompt: string) => Promise<string>, configured = true) => ({ isConfigured: () => configured, generateText: vi.fn(generate) });
const trim = (raw: string) => raw.trim();

describe('single AI brief runner (#106)', () => {
  it('returns sanitized text and caches it per key while the prompt is unchanged', async () => {
    const store: BriefCache = new Map();
    const d = deps(async () => '  hello ');
    const first = await runAiBrief({ deps: d, prompt: 'p', sanitize: trim, cache: { store, key: 'k' } });
    expect(first).toEqual({ status: 'ok', text: 'hello', cached: false });
    expect(await runAiBrief({ deps: d, prompt: 'p', sanitize: trim, cache: { store, key: 'k' } })).toEqual({ status: 'ok', text: 'hello', cached: true });
    expect(d.generateText).toHaveBeenCalledTimes(1);
    await runAiBrief({ deps: d, prompt: 'p', sanitize: trim, cache: { store, key: 'k', force: true } });
    await runAiBrief({ deps: d, prompt: 'changed', sanitize: trim, cache: { store, key: 'k' } });
    expect(d.generateText).toHaveBeenCalledTimes(3);
  });
  it('runs without a cache', async () => {
    expect(await runAiBrief({ deps: deps(async () => 'x'), prompt: 'p', sanitize: trim })).toEqual({ status: 'ok', text: 'x', cached: false });
  });
  it('reports a missing provider and an empty answer', async () => {
    const d = deps(async () => 'x', false);
    expect(await runAiBrief({ deps: d, prompt: 'p', sanitize: trim })).toEqual({ status: 'no-key' });
    expect(d.generateText).not.toHaveBeenCalled();
    expect(await runAiBrief({ deps: deps(async () => '   '), prompt: 'p', sanitize: trim })).toEqual({ status: 'empty' });
  });
  it('maps provider failures to error messages', async () => {
    expect(await runAiBrief({ deps: deps(async () => { throw new Error('boom'); }), prompt: 'p', sanitize: trim })).toEqual({ status: 'error', message: 'boom' });
    expect(await runAiBrief({ deps: deps(async () => { throw 'plain'; }), prompt: 'p', sanitize: trim })).toEqual({ status: 'error', message: 'plain' });
  });
  it('orders cancellation against the provider check by option', async () => {
    const aborted = AbortSignal.abort();
    const missing = deps(async () => 'x', false);
    expect(await runAiBrief({ deps: missing, prompt: 'p', sanitize: trim, signal: aborted })).toEqual({ status: 'no-key' });
    expect(await runAiBrief({ deps: missing, prompt: 'p', sanitize: trim, signal: aborted, cancelBeforeProvider: true })).toEqual({ status: 'cancelled' });
    expect(await runAiBrief({ deps: deps(async () => 'x'), prompt: 'p', sanitize: trim, signal: aborted })).toEqual({ status: 'cancelled' });
  });
  it('cancels during generation, after generation and on an abort error', async () => {
    const controller = new AbortController();
    const slow = deps(() => new Promise<string>(() => undefined));
    const pending = runAiBrief({ deps: slow, prompt: 'p', sanitize: trim, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ status: 'cancelled' });
    const late = new AbortController();
    expect(await runAiBrief({ deps: deps(async () => { late.abort(); return 'text'; }), prompt: 'p', sanitize: trim, signal: late.signal })).toEqual({ status: 'cancelled' });
    const live = new AbortController();
    expect(await runAiBrief({ deps: deps(async () => { throw new DOMException('x', 'AbortError'); }), prompt: 'p', sanitize: trim, signal: live.signal })).toEqual({ status: 'cancelled' });
    expect(await runAiBrief({ deps: deps(async () => 'ok'), prompt: 'p', sanitize: trim, signal: live.signal })).toEqual({ status: 'ok', text: 'ok', cached: false });
  });
});
