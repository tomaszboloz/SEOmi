import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { clearBriefCache, generateRewriteBrief, sanitizeBrief } from '@/services/siteFocusBenchmark';
import { diabetesSite } from './siteFocusFixtures';

const report = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/');
const page = report.pages.find((p) => p.url.includes('phones')) ?? report.pages[0];
const deps = (text: string | Error = 'Brief text', configured = true) => ({ isConfigured: () => configured, generateText: vi.fn(async () => { if (text instanceof Error) throw text; return text; }) });

beforeEach(clearBriefCache);
afterEach(clearBriefCache);

describe('sanitizeBrief', () => {
  it('removes fences, markup, control chars and caps length', () => {
    expect(sanitizeBrief('```md\n<b>Hi</b>\u0007\r\n\r\n\r\n\r\nthere\n```')).toBe('Hi\n\nthere');
    expect(sanitizeBrief('x'.repeat(9000)).length).toBe(8000);
  });
});

describe('generateRewriteBrief', () => {
  it('generates, sanitizes and caches per url', async () => {
    const d = deps('<i>Plan</i>');
    const first = await generateRewriteBrief(d, page, report.coreTopic);
    expect(first).toMatchObject({ status: 'ok', text: 'Plan', cached: false });
    const second = await generateRewriteBrief(d, page, report.coreTopic);
    expect(second).toMatchObject({ status: 'ok', cached: true });
    expect(d.generateText).toHaveBeenCalledTimes(1);
    await generateRewriteBrief(d, page, report.coreTopic, { force: true });
    expect(d.generateText).toHaveBeenCalledTimes(2);
    await generateRewriteBrief(d, { ...page, trs: page.trs + 1 }, report.coreTopic);
    expect(d.generateText).toHaveBeenCalledTimes(3);
  });
  it('handles missing key, empty output and errors', async () => {
    expect(await generateRewriteBrief(deps('x', false), page, report.coreTopic)).toEqual({ status: 'no-key' });
    expect(await generateRewriteBrief(deps('```\n```'), page, report.coreTopic)).toEqual({ status: 'empty' });
    expect(await generateRewriteBrief(deps(new Error('HTTP 500')), page, report.coreTopic)).toEqual({ status: 'error', message: 'HTTP 500' });
    const failing = { isConfigured: () => true, generateText: vi.fn().mockRejectedValue('plain') };
    expect(await generateRewriteBrief(failing, page, report.coreTopic)).toEqual({ status: 'error', message: 'plain' });
  });
  it('supports cancellation before and during generation', async () => {
    const before = new AbortController(); before.abort();
    expect(await generateRewriteBrief(deps(), page, report.coreTopic, { signal: before.signal })).toEqual({ status: 'cancelled' });
    const during = new AbortController();
    const slow = { isConfigured: () => true, generateText: vi.fn(() => new Promise<string>(() => undefined)) };
    const pending = generateRewriteBrief(slow, page, report.coreTopic, { signal: during.signal });
    during.abort();
    expect(await pending).toEqual({ status: 'cancelled' });
    const live = new AbortController();
    expect(await generateRewriteBrief(deps('ok'), page, report.coreTopic, { signal: live.signal })).toMatchObject({ status: 'ok' });
    clearBriefCache();
    const abortedByError = new AbortController();
    const rejecting = { isConfigured: () => true, generateText: vi.fn(async () => { abortedByError.abort(); throw new Error('x'); }) };
    expect(await generateRewriteBrief(rejecting, page, report.coreTopic, { signal: abortedByError.signal })).toEqual({ status: 'cancelled' });
  });
});
