import { describe, expect, it, vi } from 'vitest';
import { getBacklinkAnchorsPage, getBacklinkGapPage, getBacklinkProfile, getBacklinksPage, getBacklinksSummary } from '@/services/dataforseo/dataforseoBacklinks';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';

const client = (...responses: unknown[]) => {
  const post = vi.fn().mockImplementation(async () => responses.shift());
  return { post } as unknown as DataForSEOCore;
};

describe('DataForSEO backlink service contracts', () => {
  it('maps summary evidence and distinguishes an absent provider item', async () => {
    const bounded = client([{ backlinks: 100, referring_domains: '4', referring_main_domains: 3, rank: 20, broken_backlinks: 2, referring_links_attributes: { nofollow: 125 } }]);
    expect(await getBacklinksSummary(bounded, 'example.test')).toMatchObject({ target: 'example.test', total_backlinks: 100, referring_domains: 4, dofollow_backlinks: 0, broken_backlinks: 2 });
    expect((bounded as unknown as { post: ReturnType<typeof vi.fn> }).post).toHaveBeenCalledWith('/v3/backlinks/summary/live', [{ target: 'example.test', internal_list_limit: 1000 }]);

    expect(await getBacklinksSummary(client([{ backlinks: 8, dofollow: 3 }]), 'fallback.test')).toMatchObject({ dofollow_backlinks: 3 });
    expect(await getBacklinksSummary(client([]), 'missing.test')).toBeNull();
  });

  it('maps anchor percentages, nullable totals, booleans and source rows directly', async () => {
    const anchors = await getBacklinkAnchorsPage(client([{ total_count: '2', referring_subnets: 0, items: [{ anchor: 'brand', backlinks: 5 }, { anchor: 7, backlinks: 'bad' }] }]), 'example.test', 4, 25, 10);
    expect(anchors).toEqual({ items: [{ anchor: 'brand', count: 5, percentage: 50 }, { anchor: '', count: 0, percentage: 0 }], totalCount: 2, referringSubnets: 0 });
    expect((await getBacklinkAnchorsPage(client([{ items: [{ anchor: 'brand', backlinks: 1 }] }]), 'example.test')).items[0].percentage).toBeNull();

    const page = await getBacklinksPage(client([{ total_count: '1', items: [{ title: 'Source', url_from: 'https://source.test', url_to: 'https://example.test', anchor: 'brand', dofollow: 'yes', rank: '12', first_seen: '2026-01-01' }] }]), 'example.test');
    expect(page).toEqual({ items: [{ source_title: 'Source', source_url: 'https://source.test', target_url: 'https://example.test', anchor_text: 'brand', is_dofollow: true, domain_rank: 12, first_seen: '2026-01-01' }], totalCount: 1 });
  });

  it('bounds gap pagination and discards rows without a usable referring domain', async () => {
    const gap = client([{ total_count: '4', items: [
      { domain_intersection: { '1': { target: 'WWW.Ref.Example', backlinks: 2, rank: '10', backlinks_spam_score: 4 }, '2': { target: 'ignored', backlinks: 0 } } },
      { domain_intersection: { '1': { target: 'Ref-2.Example', backlinks: 3, backlinks_spam_score: null }, '2': { target: 'Ref-2.Example', backlinks: 1, rank: 5, backlinks_spam_score: 8 } } },
      { domain_intersection: { '1': { target: '', backlinks: 2 } } }, { domain_intersection: {} },
    ] }]);
    const page = await getBacklinkGapPage(gap, 'https://www.target.example/path', ['https://www.CompA.example/path', 'compB.example'], -1.8, 0, false);
    expect(page).toMatchObject({ totalCount: 4, rawCount: 4, items: [
      { referring_domain: 'ref.example', competitor_backlinks: [{ domain: 'compa.example', backlinks: 2, rank: 10 }], max_competitor_spam_score: 4 },
      { referring_domain: 'ref-2.example', max_competitor_spam_score: 8 },
    ] });
    expect((gap as unknown as { post: ReturnType<typeof vi.fn> }).post.mock.calls[0][1][0]).toMatchObject({ targets: { '1': 'compa.example', '2': 'compb.example' }, exclude_targets: ['target.example'], offset: 0, limit: 100, include_subdomains: false });
  });

  it('returns null without a summary and combines the three profile requests with a ratio', async () => {
    const missing = client([]);
    expect(await getBacklinkProfile(missing, 'missing.test')).toBeNull();
    expect((missing as unknown as { post: ReturnType<typeof vi.fn> }).post).toHaveBeenCalledTimes(1);

    const profile = await getBacklinkProfile(client(
      [{ backlinks: 4, referring_domains: 2, referring_main_domains: 2, rank: 30, dofollow: 1 }],
      [{ total_count: 1, referring_subnets: 2, items: [{ anchor: 'brand', backlinks: 4 }] }],
      [{ total_count: 1, items: [{ title: 'Source', url_from: 'https://source.test', url_to: 'https://example.test', anchor: 'brand', dofollow: false, rank: 9, first_seen: 'today' }] }],
    ), 'example.test');
    expect(profile).toMatchObject({ domain: 'example.test', total_backlinks: 4, referring_domains: 2, referring_subnets: 2, domain_rank: 30, dofollow_ratio: 25, total_anchor_rows: 1, total_backlink_rows: 1 });
    expect(profile?.anchors[0].percentage).toBe(100);
    expect(profile?.backlinks[0].is_dofollow).toBe(false);
  });
});
