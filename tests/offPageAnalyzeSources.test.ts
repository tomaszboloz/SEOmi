import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { createProvider } from '@/services/embeddings/registry';
import { analyzeSources } from '@/services/offPage/analyzeSources';
import { deferredSource, sourceAudit, sourceLink, sourceProfile, sourceVector } from './fixtures/offPageSources';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/embeddings/registry', () => ({ createProvider: vi.fn() }));
vi.mock('@/services/offPage/sourcePacer', () => ({ waitForSourceSlot: async () => {} }));
beforeEach(() => {
  vi.mocked(invokeTauriCommand).mockReset();
  vi.mocked(createProvider).mockReset().mockReturnValue({ id: 'local', model: 'hash', embed: async (texts) => texts.map(() => sourceVector(1, 0)) });
});
describe('bounded session source analysis', () => {
  it('fetches only three sources concurrently, isolates failures, updates progress and embeds actual text', async () => {
    const pending = Array.from({ length: 5 }, () => deferredSource<ReturnType<typeof sourceAudit>>());
    let next = 0;
    let active = 0;
    let maximum = 0;
    vi.mocked(invokeTauriCommand).mockImplementation(() => {
      active += 1;
      maximum = Math.max(maximum, active);
      return pending[next++].promise.finally(() => { active -= 1; }) as never;
    });
    const profile = sourceProfile(Array.from({ length: 5 }, (_, index) => sourceLink(`https://site${index}.test`, 80 - index)));
    const update = vi.fn();
    const result = analyzeSources(profile, 'Acme', 'SEO', 'SEO', { provider: 'local' }, new AbortController().signal, update);
    await vi.waitFor(() => expect(invokeTauriCommand).toHaveBeenCalledTimes(3));
    pending[0].resolve(sourceAudit('Acme SEO'));
    pending[1].reject('Response size exceeds safety limit');
    await vi.waitFor(() => expect(invokeTauriCommand).toHaveBeenCalledTimes(5));
    pending[2].resolve(sourceAudit(''));
    pending[3].resolve(sourceAudit('Acme SEO second source'));
    pending[4].reject('private address blocked');
    const evidence = await result;
    expect(maximum).toBe(3);
    expect(evidence.sources.map((source) => source.availability)).toEqual(['ok', 'too-large', 'unavailable', 'ok', 'blocked']);
    expect(evidence.sources.map((source) => source.vector)).toEqual([sourceVector(1, 0), null, null, sourceVector(1, 0), null]);
    expect(evidence.aliases).toContain('acme.test');
    expect(update).toHaveBeenCalledTimes(6);
    expect(update.mock.calls[0][0].every((source: { fetchedAt: string | null }) => source.fetchedAt === null)).toBe(true);
  });
  it('supports no follow links and missing core without fake vectors or provider calls', async () => {
    const evidence = await analyzeSources(sourceProfile([sourceLink('https://x.test', 80, false)]), undefined, '', '',
      { provider: 'local' }, new AbortController().signal, vi.fn());
    expect(evidence.sources).toEqual([]);
    expect(evidence.topic).toBeNull();
    expect(createProvider).not.toHaveBeenCalled();
    expect(invokeTauriCommand).not.toHaveBeenCalled();
  });
  it('stops scheduling on cancel and never embeds stale source results', async () => {
    const controller = new AbortController();
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => command === 'inspect_url' ? new Promise(() => {}) : true);
    const profile = sourceProfile(Array.from({ length: 5 }, (_, index) => sourceLink(`https://site${index}.test`)));
    const result = analyzeSources(profile, undefined, 'SEO', 'SEO', { provider: 'local' }, controller.signal, vi.fn());
    const rejection = expect(result).rejects.toThrow();
    await vi.waitFor(() => expect(invokeTauriCommand).toHaveBeenCalledTimes(3));
    controller.abort();
    await rejection;
    expect(vi.mocked(invokeTauriCommand).mock.calls.filter(([command]) => command === 'inspect_url')).toHaveLength(3);
    expect(createProvider).not.toHaveBeenCalled();
    await expect(analyzeSources(profile, '', '', '', { provider: 'local' }, controller.signal, vi.fn())).rejects.toThrow();
  });
});
