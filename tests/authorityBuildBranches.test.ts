import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthorityReport } from '@/services/topicalAuthority/build';
import { buildContext } from '@/services/topicalAuthority/context';
import { mapCoverage } from '@/services/topicalAuthority/coverage';
import { authorityContext, authorityCoverage, authorityPage } from './authorityDirectFixtures';
import { NOW, OWN_HOST, ownReport, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/topicalAuthority/context', async (original) => ({
  ...await original<typeof import('@/services/topicalAuthority/context')>(), buildContext: vi.fn(),
}));
vi.mock('@/services/topicalAuthority/coverage', async (original) => ({
  ...await original<typeof import('@/services/topicalAuthority/coverage')>(), mapCoverage: vi.fn(),
}));

const context = vi.mocked(buildContext);
const mapped = vi.mocked(mapCoverage);
const sfs = ownReport();
const start = `https://${OWN_HOST}/`;
beforeEach(() => { context.mockReturnValue(authorityContext([])); mapped.mockReturnValue([]); });
afterEach(() => { vi.useRealTimers(); });

describe('direct authority builder boundaries', () => {
  it('uses the current clock when no report time is supplied and leaves empty velocity unavailable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const report = buildAuthorityReport([], start, sfs);
    expect(report.generatedAt).toBe(NOW);
    expect(report.pillars.cvff).toBeNull();
    expect(report.freshness).toMatchObject({ total: 0, dated: 0, undated: 0 });
  });

  it('assigns equal-importance topics lexically, shares a pillar and skips absent context URLs', () => {
    const pages = ['/one', '/two', '/three'].map((path) => authorityPage(`${start}${path.slice(1)}`));
    context.mockReturnValue(authorityContext(pages));
    mapped.mockReturnValue([
      authorityCoverage({ subtopicId: 'z', pillar: 'z', urls: [pages[0].url] }),
      authorityCoverage({ subtopicId: 'a', pillar: 'a', urls: [pages[0].url, pages[1].url, '/missing'] }),
      authorityCoverage({ subtopicId: 'b', pillar: 'b', urls: [pages[2].url] }),
    ]);
    const report = buildAuthorityReport([], start, sfs, { taxonomy: referenceTaxonomy(), now: NOW });
    expect(report.silo.audits[pages[1].url].pillarUrl).toBe(pages[0].url);
    expect(report.silo.audits).not.toHaveProperty('/missing');
    expect(report.freshness.total).toBe(3);
  });
});
