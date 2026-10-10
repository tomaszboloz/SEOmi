import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { getBacklinkGapPage } from '@/services/dataforseo/dataforseoBacklinks';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';

const emptyClient = () => {
  const post = vi.fn();
  return { client: { post } as unknown as DataForSEOCore, post };
};

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('DataForSEO backlink validation boundaries', () => {
  it.each([
    ['', ['competitor.test'], 'domainRequired'],
    ['localhost', ['competitor.test'], 'domainInvalid'],
    ['ftp://target.test', ['competitor.test'], 'domainCredentials'],
    ['target.test', [], 'competitorRequired'],
    ['target.test', ['target.test'], 'competitorRequired'],
    ['target.test', Array.from({ length: 20 }, (_, index) => `competitor-${index}.test`), 'competitorLimit'],
  ])('rejects invalid gap input before a paid request (%s)', async (target, competitors, code) => {
    const { client, post } = emptyClient();
    await expect(getBacklinkGapPage(client, target, competitors)).rejects.toThrow(i18n.t(`runtimeErrors.dataforseo.${code}`));
    expect(post).not.toHaveBeenCalled();
  });

  it('does not invent a referring domain when provider intersection rows lack one', async () => {
    const post = vi.fn().mockResolvedValue([{ total_count: null, items: [
      { domain_intersection: { '1': { target: '', backlinks: 2 } } },
      { domain_intersection: {} },
    ] }]);
    const page = await getBacklinkGapPage({ post } as unknown as DataForSEOCore, 'target.test', ['competitor.test']);
    expect(page).toEqual({ items: [], totalCount: null, rawCount: 2 });
    expect(post).toHaveBeenCalledWith('/v3/backlinks/domain_intersection/live', [expect.objectContaining({
      targets: { '1': 'competitor.test' }, exclude_targets: ['target.test'], limit: 100, offset: 0,
    })]);
  });
});
