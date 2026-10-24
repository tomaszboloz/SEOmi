import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n, { LANGUAGES, loadLocale } from '@/i18n';
import { CrawlCrawlerReadinessTab } from '@/components/Domain/crawlResults/CrawlCrawlerReadinessTab';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import { logRun } from './fixtures/logIntel';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);
const leaves = (value: Record<string, unknown>, prefix = ''): Record<string, string> => Object.fromEntries(Object.entries(value).flatMap(([key, entry]) =>
  typeof entry === 'string' ? [[`${prefix}${key}`, entry]] : Object.entries(leaves(entry as Record<string, unknown>, `${prefix}${key}.`))));

describe('log intelligence integration and translations', () => {
  it('mounts lazily in crawler readiness using the latest active-project crawl and resets on project change', async () => {
    const latest = logRun([['/latest']], { completedAt: '2026-10-24' });
    const old = logRun([['/old']], { completedAt: '2026-10-01' });
    const other = logRun([['/foreign']], { completedAt: '2026-11-01', projectId: 'p2' });
    const session = { result: old.result, runs: [old, latest, other], activeProjectId: 'p1' } as unknown as ReturnType<typeof useCrawlResultsSession>;
    const { rerender } = render(<CrawlCrawlerReadinessTab session={session} />);
    expect(await screen.findByRole('heading', { name: 'Log intelligence' })).toBeTruthy();
    expect(await screen.findByText('/latest')).toBeTruthy();
    expect(screen.queryByText('/old')).toBeNull();
    expect(screen.queryByText('/foreign')).toBeNull();
    rerender(<CrawlCrawlerReadinessTab session={{ ...session, activeProjectId: 'p2' }} />);
    expect(await screen.findByText('/foreign')).toBeTruthy();
    expect(screen.queryByText('/latest')).toBeNull();
    rerender(<CrawlCrawlerReadinessTab session={{ ...session, activeProjectId: null }} />);
    expect(screen.queryByRole('heading', { name: 'Log intelligence' })).toBeNull();
  });
  it.each(LANGUAGES.map((language) => language.code))('provides every namespace key and interpolation in %s without English fallback', async (code) => {
    const en = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8')).logIntelUi;
    const raw = JSON.parse(readFileSync(`src/i18n/locales/${code}.json`, 'utf8')).logIntelUi;
    const expected = leaves(en);
    const actual = leaves(raw);
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    expect((await loadLocale(code)).logIntelUi).toEqual(raw);
    for (const [key, value] of Object.entries(actual)) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value.match(/{{\w+}}/g)?.sort()).toEqual(expected[key].match(/{{\w+}}/g)?.sort());
    }
    if (code !== 'en') expect(raw.description).not.toBe(en.description);
  });
});
