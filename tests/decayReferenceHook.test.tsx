import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { loadSerpHistory } from '@/services/semanticDecay/snapshotStore';
import { COMPETITORS, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

const pages = ownSite();
const START = `https://${OWN_HOST}/`;

beforeEach(() => localStorage.clear());

describe('reference build feeds the Decay Radar history', () => {
  it('records one snapshot per successful reference run with the configured market', async () => {
    const taxonomy = referenceTaxonomy(pages) as NonNullable<ReturnType<typeof referenceTaxonomy>>;
    const serp = [{ query: 'coffee', source: 'dataforseo', hits: [{ url: 'https://rival-one.test/', rank: 1, domain: 'rival-one.test' }] }];
    const runner = vi.fn(async () => ({ status: 'ok' as const, taxonomy, competitors: COMPETITORS, serp }));
    const market = () => ({ country: 'DE', language: 'de' });
    const { result } = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: ownReport(pages), projectId: 'decay-p', runner, market }));
    await act(async () => { await result.current.build(); });
    const history = loadSerpHistory('decay-p');
    expect(history.snapshots).toHaveLength(1);
    expect(history.snapshots[0]).toMatchObject({ country: 'DE', language: 'de', provider: 'dataforseo', query: taxonomy.coreLabel });
  });
});
