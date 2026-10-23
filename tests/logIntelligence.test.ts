import { describe, expect, it } from 'vitest';
import { buildCrawlMatrix, claimedFamily, emptyImportState, importAccessLog, inRanges, parseLogLine, verifyBot } from '@/services/logIntelligence';

const GB = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const line = (over: { ip?: string; ts?: string; path?: string; status?: number; ua?: string; extra?: string } = {}) =>
  `${over.ip ?? '66.249.66.1'} - - [${over.ts ?? '10/Oct/2026:13:55:36 +0200'}] "GET ${over.path ?? '/a?utm=1'} HTTP/1.1" ${over.status ?? 200} 512 "-" "${over.ua ?? GB}"${over.extra ?? ''}`;

describe('parseLogLine', () => {
  it('parses combined lines with timezone and strips the query', () => {
    const hit = parseLogLine(line({ extra: ' 0.25' }))!;
    expect(hit).toMatchObject({ ip: '66.249.66.1', path: '/a', status: 200, bytes: 512, latencyMs: 250 });
    expect(hit.at).toBe(Date.UTC(2026, 9, 10, 11, 55, 36));
    expect(parseLogLine(line({ extra: ' 250000' }), { latencyUnit: 'microseconds' })?.latencyMs).toBe(250);
    expect(parseLogLine(line({ extra: ' 1' }), { latencyUnit: 'none' })?.latencyMs).toBeNull();
    expect(parseLogLine(line())?.latencyMs).toBeNull();
    expect(parseLogLine(line(), { keepQuery: true })?.path).toBe('/a?utm=1');
    expect(parseLogLine(line({ ts: '10/Oct/2026:13:55:36 -0500' }))?.at).toBe(Date.UTC(2026, 9, 10, 18, 55, 36));
  });
  it('handles "-" bytes and rejects malformed or impossible dates', () => {
    expect(parseLogLine(line().replace(' 512 ', ' - '))?.bytes).toBeNull();
    expect(parseLogLine('garbage')).toBeNull();
    expect(parseLogLine(line({ ts: '31/Feb/2026:10:00:00 +0000' }))).toBeNull();
    expect(parseLogLine(line({ ts: '10/Xxx/2026:10:00:00 +0000' }))).toBeNull();
    expect(parseLogLine(line({ ts: '10/Oct/2026:25:00:00 +0000' }))).toBeNull();
  });
});

describe('bot verification', () => {
  const dns = (rev: string[], fwd: string[]) => ({ resolver: { reverse: async () => rev, forward: async () => fwd }, now: () => 5 });
  it('finds claims, ranges and CIDR edges', () => {
    expect(claimedFamily(GB)).toBe('googlebot');
    expect(claimedFamily('GPTBot/1.0')).toBe('gptbot');
    expect(claimedFamily('Google-Extended')).toBeNull();
    expect(inRanges('1.2.3.4', ['1.2.3.0/24'])).toBe(true);
    expect(inRanges('1.2.4.4', ['1.2.3.0/24', 'x/9', '1.2.3.0/40'])).toBe(false);
    expect(inRanges('::1', ['1.2.3.0/24'])).toBe(false);
    expect(inRanges('300.1.1.1', ['1.2.3.0/24'])).toBe(false);
  });
  it('verifies by reverse+forward DNS', async () => {
    expect(await verifyBot('66.249.66.1', GB, dns(['crawl-1.googlebot.com.'], ['66.249.66.1']))).toMatchObject({ family: 'googlebot', status: 'verified', checkedAt: 5 });
    expect(await verifyBot('1.1.1.1', GB, dns(['evil.example.com'], ['1.1.1.1']))).toMatchObject({ status: 'spoofed' });
    expect(await verifyBot('1.1.1.1', GB, dns(['a.googlebot.com'], ['9.9.9.9']))).toMatchObject({ status: 'spoofed' });
  });
  it('keeps claims unverified without evidence and on DNS failure', async () => {
    expect(await verifyBot('1.1.1.1', GB)).toMatchObject({ status: 'claimed', method: 'none' });
    expect(await verifyBot('1.1.1.1', 'GPTBot')).toMatchObject({ status: 'claimed' });
    const failing = { resolver: { reverse: async (): Promise<string[]> => { throw new Error('timeout'); }, forward: async () => [] } };
    expect(await verifyBot('1.1.1.1', GB, failing)).toMatchObject({ status: 'claimed' });
    expect(await verifyBot('1.1.1.1', 'curl/8')).toMatchObject({ family: null, status: 'unknown' });
    expect(await verifyBot('1.1.1.1', 'PerplexityBot', { ranges: { perplexitybot: ['1.1.1.0/24'] } })).toMatchObject({ status: 'verified', method: 'published-ranges' });
    expect(await verifyBot('2.2.2.2', 'PerplexityBot', { ranges: { perplexitybot: ['1.1.1.0/24'] } })).toMatchObject({ status: 'spoofed' });
  });
});

const verified = { resolver: { reverse: async () => ['x.googlebot.com'], forward: async () => ['66.249.66.1'] } };

describe('importAccessLog', () => {
  it('aggregates bot hits and drops IPs, counting malformed and non-bot lines', async () => {
    const lines = [line(), line({ ts: '10/Oct/2026:14:55:36 +0200', status: 404 }), line({ ts: '11/Oct/2026:14:55:36 +0200', status: 301, extra: ' 0.5' }), line({ ua: 'curl/8' }), 'bad', line({ status: 999 })];
    const state = await importAccessLog({ lines, fileHash: 'h1', verify: verified });
    const agg = Object.values(state.aggs)[0];
    expect(agg).toMatchObject({ path: '/a', family: 'googlebot', status: 'verified', hits: 3, bytes: 1536, latencyCount: 1, latencySumMs: 500 });
    expect(agg.statusGroups).toEqual({ '2xx': 1, '3xx': 1, '4xx': 1, '5xx': 0 });
    expect(agg.maxIntervalMs).toBe(24 * 3_600_000);
    expect(state).toMatchObject({ malformed: 1, ignoredNonBot: 2, lines: 6, days: ['2026-10-10', '2026-10-11'] });
    expect(JSON.stringify(state)).not.toContain('66.249');
  });
  it('skips duplicate files and does not mutate input state', async () => {
    const first = await importAccessLog({ lines: [line()], fileHash: 'h1', verify: verified });
    const again = await importAccessLog({ lines: [line()], fileHash: 'h1', state: first, verify: verified });
    expect(again.lines).toBe(1);
    const other = await importAccessLog({ lines: [line()], fileHash: 'h2', state: first, verify: verified });
    expect(other.lines).toBe(2);
    expect(first.lines).toBe(1);
    expect(first.fileHashes).toEqual(['h1']);
  });
  it('cancels and resumes without double counting', async () => {
    const lines = [line(), line({ ts: '10/Oct/2026:15:00:00 +0200' }), line({ ts: '10/Oct/2026:16:00:00 +0200' })];
    let seen = 0;
    const partial = await importAccessLog({ lines, fileHash: 'h', verify: verified, shouldCancel: () => seen++ >= 2 });
    expect(partial.inProgress).toEqual({ hash: 'h', offset: 2 });
    expect(partial.lines).toBe(2);
    const done = await importAccessLog({ lines, fileHash: 'h', state: partial, verify: verified });
    expect(done.lines).toBe(3);
    expect(done.inProgress).toBeNull();
    expect(Object.values(done.aggs)[0].hits).toBe(3);
  });
});

describe('Crawl Efficiency Matrix', () => {
  const day = (d: number) => `${String(d).padStart(2, '0')}/Oct/2026:10:00:00 +0000`;
  const build = async (days: number, hitsOnA: number, claimedOnly = false) => {
    const lines: string[] = [];
    for (let d = 1; d <= days; d++) lines.push(line({ ts: day(d), path: '/other' }));
    for (let i = 0; i < hitsOnA; i++) lines.push(line({ ts: day(1 + (i % days)), path: '/a' }));
    return importAccessLog({ lines, fileHash: 'm', verify: claimedOnly ? undefined : verified });
  };
  const trs = new Map([['/a', 30], ['/other', 80], ['/idle', 20], ['/high', 90]]);
  it('reports no-logs, never OPTIMAL', () => {
    const r = buildCrawlMatrix(emptyImportState(), trs);
    expect(r.rows.every((row) => row.verdict === 'no-logs' && row.hits === null)).toBe(true);
    expect(r.sufficient).toBe(false);
  });
  it('is inconclusive with partial coverage', async () => {
    const r = buildCrawlMatrix(await build(10, 30), trs);
    expect(r.coverageDays).toBe(10);
    expect(r.rows.find((row) => row.path === '/a')).toMatchObject({ verdict: 'inconclusive', linkReviewCandidate: false });
  });
  it('flags waste, starvation and ok with enough coverage; boundaries are strict', async () => {
    const r = buildCrawlMatrix(await build(30, 26), trs);
    expect(r.sufficient).toBe(true);
    const verdict = (path: string) => r.rows.find((row) => row.path === path)!.verdict;
    expect(verdict('/a')).toBe('waste');
    expect(verdict('/idle')).toBe('starvation');
    expect(verdict('/other')).toBe('ok');
    expect(verdict('/high')).toBe('starvation');
    expect(buildCrawlMatrix(await build(30, 25), trs).rows.find((row) => row.path === '/a')!.verdict).toBe('ok');
    expect(buildCrawlMatrix(await build(30, 26), trs, { wasteMaxTrs: 30 }).rows.find((row) => row.path === '/a')!.verdict).toBe('ok');
  });
  it('counts claimed hits only on request and lists log-only paths without TRS', async () => {
    const state = await build(30, 30, true);
    expect(buildCrawlMatrix(state, trs).rows.find((row) => row.path === '/a')).toMatchObject({ hits: 0, verdict: 'starvation' });
    expect(buildCrawlMatrix(state, trs, { includeClaimed: true }).rows.find((row) => row.path === '/a')).toMatchObject({ hits: 30, verdict: 'waste' });
    expect(buildCrawlMatrix(state, new Map(), { includeClaimed: true }).rows.find((row) => row.path === '/a')).toMatchObject({ trs: null, verdict: 'ok' });
  });
});
