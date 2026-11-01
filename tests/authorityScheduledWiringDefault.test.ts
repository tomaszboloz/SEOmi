import { describe, expect, it, vi } from 'vitest';

const runScheduledAuthority = vi.hoisted(() => vi.fn().mockResolvedValue({ recorded: true, refresh: 'disabled' }));
const runReference = vi.hoisted(() => vi.fn().mockResolvedValue({ status: 'cancelled' }));
vi.mock('@/services/topicalAuthorityMonitoring/scheduledAuthority', () => ({ runScheduledAuthority }));
vi.mock('@/services/topicalAuthorityReference/run', () => ({ runReference }));

import { runScheduledAuthorityDefault } from '@/services/topicalAuthorityMonitoring/scheduledAuthorityWiring';
import { writeEntitySettings } from '@/services/topicalAuthorityMonitoring';
import { createCrawlRunFixture } from './fixtures/crawl';

describe('runScheduledAuthorityDefault', () => {
  it('wires the refresh to the shared reference runner', async () => {
    const run = createCrawlRunFixture();
    await runScheduledAuthorityDefault('p1', run);
    const deps = runScheduledAuthority.mock.calls[0][2];
    await expect(deps.refresh({ startUrl: 'https://x.test/' })).resolves.toEqual({ status: 'cancelled' });
    expect(runReference).toHaveBeenCalledOnce();
    expect(runReference.mock.calls[0][1]).toMatchObject({ entityMode: 'lexical' });
  });

  it('uses the project entity recognition setting for scheduled refreshes', async () => {
    writeEntitySettings('p2', { mode: 'ollama', model: 'qwen3' });
    await runScheduledAuthorityDefault('p2', createCrawlRunFixture());
    const deps = runScheduledAuthority.mock.calls.at(-1)![2];
    await deps.refresh({ startUrl: 'https://x.test/' });
    expect(runReference.mock.calls.at(-1)![1]).toMatchObject({ entityMode: 'ollama' });
    expect(typeof runReference.mock.calls.at(-1)![0].extractEntities).toBe('function');
  });
});
