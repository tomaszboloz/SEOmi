import { describe, expect, it, vi } from 'vitest';
import { importAccessLog, type Resolver } from '@/services/logIntelligence';

const DESKTOP = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PHONE = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1)';
const BING = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
const HUMAN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/140.0';

const line = (ip: string, userAgent: string, path = '/a'): string =>
  `${ip} - - [10/Oct/2026:13:55:36 +0000] "GET ${path} HTTP/1.1" 200 512 "-" "${userAgent}"`;

const resolverFor = (hosts: Record<string, string>): Resolver & { reverse: ReturnType<typeof vi.fn> } => {
  const reverse = vi.fn(async (ip: string) => [hosts[ip] ?? 'unknown.example.net']);
  const forward = vi.fn(async (host: string) => Object.entries(hosts).filter(([, name]) => name === host).map(([ip]) => ip));
  return { reverse, forward };
};

describe('log import bot verdict cache', () => {
  it('verifies one crawler address once, whatever the UA string or IPv6 spelling', async () => {
    const resolver = resolverFor({ '66.249.66.1': 'crawl-1.googlebot.com', '2001:4860:4801:10::1': 'crawl-6.googlebot.com' });
    const state = await importAccessLog({
      lines: [line('66.249.66.1', DESKTOP), line('66.249.66.1', PHONE, '/b'), line('2001:4860:4801:10:0:0:0:1', DESKTOP), line('2001:4860:4801:10::1', PHONE)],
      fileHash: 'ua-variants', verify: { resolver },
    });
    expect(resolver.reverse).toHaveBeenCalledTimes(2);
    expect(Object.values(state.aggs).every((agg) => agg.status === 'verified')).toBe(true);
    expect(Object.values(state.aggs).reduce((sum, agg) => sum + agg.hits, 0)).toBe(4);
  });

  it('keeps human traffic out of the cache so it cannot evict verified crawlers', async () => {
    const resolver = resolverFor({ '66.249.66.1': 'crawl-1.googlebot.com' });
    const humans = Array.from({ length: 10_001 }, (_, index) => line(`203.0.${Math.floor(index / 256) % 256}.${index % 256}`, `${HUMAN} #${index}`));
    const state = await importAccessLog({
      lines: [line('66.249.66.1', DESKTOP), ...humans, line('66.249.66.1', DESKTOP)], fileHash: 'humans', verify: { resolver },
    });
    expect(resolver.reverse).toHaveBeenCalledTimes(1);
    expect(state.ignoredNonBot).toBe(10_001);
    expect(Object.values(state.aggs)).toEqual([expect.objectContaining({ family: 'googlebot', status: 'verified', hits: 2 })]);
  });

  it('checks each claimed family separately for the same address', async () => {
    const resolver = resolverFor({ '157.55.39.1': 'msnbot-157-55-39-1.search.msn.com' });
    const state = await importAccessLog({
      lines: [line('157.55.39.1', BING), line('157.55.39.1', DESKTOP), line('157.55.39.1', BING)], fileHash: 'families', verify: { resolver },
    });
    expect(resolver.reverse).toHaveBeenCalledTimes(2);
    const byFamily = Object.fromEntries(Object.values(state.aggs).map((agg) => [agg.family, agg]));
    expect(byFamily.bingbot).toMatchObject({ status: 'verified', hits: 2 });
    expect(byFamily.googlebot).toMatchObject({ status: 'spoofed', hits: 1 });
  });
});
