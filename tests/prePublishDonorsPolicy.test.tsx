import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { createProvider } from '@/services/embeddings/registry';
import { checkPrePublish } from '@/services/prePublish/embeddingCheck';
import { DONOR_PROFILE, donorSuggestions, draftAnchor } from '@/services/prePublish/donors';
import { draftChunkDetails } from '@/services/prePublish/aioChunks';
import { applyPolicy, evidenceGaps, readPrePublishPolicy, savePrePublishPolicy } from '@/services/prePublish/policy';
import { prePublishReportText } from '@/services/prePublish/reportText';
import type { PrePublishReport } from '@/services/prePublish/check';
import { PrePublishPanel } from '@/components/Charts/PrePublishPanel';
import { draftText, mockProvider, mountContext } from './fixtures/prePublishMount';

vi.mock('@/services/embeddings/registry', async (original) => ({
  ...await original<typeof import('@/services/embeddings/registry')>(), createProvider: vi.fn(),
}));
const v = (x: number) => new Float64Array([x, Math.sqrt(1 - x * x)]);
const draft = { url: 'https://s.test/new', vector: v(1), text: '# Heat pump costs\n\nBody' };
const base: PrePublishReport = { verdict: 'ok', publishApproved: true, draftTrs: 80, sfsBefore: 60, sfsAfter: 62, sfsDelta: 2, conflicts: [], chunkIssues: [], reasons: [] };

beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('link donors (#94 GEM-94-07)', () => {
  it('keeps the .60–.85 window, TRS >= 70, at most 3, ranked by similarity x TRS', () => {
    const pages = [
      { url: 'https://s.test/a', vector: v(0.8), trs: 90, links: ['https://s.test/new/'] },
      { url: 'https://s.test/b', vector: v(0.7), trs: 95 },
      { url: 'https://s.test/c', vector: v(0.6), trs: 70, links: [] },
      { url: 'https://s.test/d', vector: v(0.75), trs: 72, links: ['https://s.test/x'] },
      { url: 'https://s.test/conflict', vector: v(0.85), trs: 99 },
      { url: 'https://s.test/weak', vector: v(0.59), trs: 99 },
      { url: 'https://s.test/low-trs', vector: v(0.8), trs: 69 },
      { url: 'https://s.test/new#top', vector: v(0.8), trs: 99 },
    ];
    const donors = donorSuggestions(draft, pages);
    expect(donors.map((d) => [d.url, d.alreadyLinks])).toEqual([['https://s.test/a', true], ['https://s.test/b', null], ['https://s.test/d', false]]);
    expect(donors[0]).toMatchObject({ similarity: 0.8, trs: 90, anchor: 'Heat pump costs', placement: 'body-related-passage' });
    expect(donors).toHaveLength(DONOR_PROFILE.max);
    expect(donorSuggestions({ url: '', vector: v(1) }, pages.slice(0, 1))[0]).toMatchObject({ alreadyLinks: false, anchor: null });
    expect(draftAnchor('one two three four five six seven eight nine')).toBeNull();
    expect(draftAnchor('\n\n')).toBeNull();
  });
});

describe('draft passage detail (#94 GEM-94-06)', () => {
  it('scores passages with source offsets and keeps headings as context', () => {
    const text = '# Heat pumps\n\nIt works well.\n\nA heat pump moves heat from outside air into the house using electricity and a refrigerant cycle that runs all year.';
    const report = draftChunkDetails(text, 'en');
    expect(report).toMatchObject({ language: 'en', languageStatus: 'supported' });
    expect(report.chunks).toHaveLength(2);
    expect(report.chunks[0]).toMatchObject({ index: 0, heading: 'Heat pumps', start: text.indexOf('It works'), end: text.indexOf('It works') + 'It works well.'.length, weak: true });
    expect(report.chunks[0].issues.length).toBeGreaterThan(0);
    expect(report.chunks[1].heading).toBe('');
    expect(draftChunkDetails(`${'word '.repeat(60)}`, '').languageStatus).not.toBe('supported');
    expect(draftChunkDetails('x'.repeat(200), 'en').chunks[0].excerpt).toHaveLength(160);
  });
});

describe('advisory / enforced policy (#94 GEM-94-08)', () => {
  const now = new Date('2026-10-30T00:00:00Z');
  it('never approves with evidence gaps and holds non-OK checks only when enforced', () => {
    expect(evidenceGaps({ baselineCompletedAt: '2026-10-24T00:00:00Z', languageStatus: 'supported', now })).toEqual([]);
    expect(evidenceGaps({ baselineCompletedAt: '2026-08-01T00:00:00Z', languageStatus: 'unsupported', now })).toEqual(['stale-baseline', 'unsupported-language']);
    expect(evidenceGaps({ baselineCompletedAt: null, languageStatus: 'uncertain', now })).toEqual(['no-baseline-date']);
    expect(applyPolicy(base, 'advisory', [])).toMatchObject({ gate: 'advice', publishApproved: true });
    expect(applyPolicy(base, 'enforced', [])).toMatchObject({ gate: 'pass', publishApproved: true });
    expect(applyPolicy(base, 'enforced', ['stale-baseline'])).toMatchObject({ gate: 'hold', publishApproved: false, evidenceGaps: ['stale-baseline'] });
    expect(applyPolicy({ ...base, verdict: 'review', publishApproved: false }, 'enforced', [])).toMatchObject({ gate: 'hold', publishApproved: false });
    expect(applyPolicy(base, 'advisory', ['unsupported-language']).publishApproved).toBe(false);
  });

  it('stores the opt-in per project and defaults to advisory', () => {
    expect(readPrePublishPolicy(null)).toBe('advisory');
    expect(readPrePublishPolicy('p')).toBe('advisory');
    savePrePublishPolicy('p', 'enforced');
    expect(readPrePublishPolicy('p')).toBe('enforced');
    expect(readPrePublishPolicy('q')).toBe('advisory');
  });

  it('adds donors, passage detail and the policy outcome to the embedded check', async () => {
    mockProvider();
    const result = await checkPrePublish(draftText, '', mountContext(), { provider: 'ollama' }, new AbortController().signal, 'enforced', new Date('2026-10-25T00:00:00Z'));
    expect(createProvider).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ policy: 'enforced', gate: 'hold', publishApproved: false, evidenceGaps: [], donors: [] });
    expect(result.chunkDetails).toMatchObject({ language: 'en', languageStatus: 'supported' });
    const stale = await checkPrePublish(draftText, '', mountContext(), { provider: 'ollama' }, new AbortController().signal);
    expect(stale.policy).toBe('advisory');
  });
});

describe('pre-publish details UI', () => {
  it('shows gate, gaps, donors and weak passages, and copies them', () => {
    const report = applyPolicy({
      ...base, donors: [{ url: 'https://s.test/a', similarity: 0.8, trs: 90, alreadyLinks: false, anchor: 'Heat', placement: 'body-related-passage' },
        { url: 'https://s.test/b', similarity: 0.7, trs: 80, alreadyLinks: null, anchor: null, placement: 'body-related-passage' }],
      chunkDetails: draftChunkDetails('# H\n\nIt works.', 'en'),
    }, 'enforced', ['stale-baseline']);
    render(<PrePublishPanel report={report} />);
    expect(screen.getByText(/Policy: enforced. Held for human review/)).toBeTruthy();
    expect(screen.getByText('The baseline crawl is older than 30 days.')).toBeTruthy();
    expect(screen.getByText(/https:\/\/s.test\/a \(similarity 80.0%, TRS 90\)/)).toBeTruthy();
    expect(screen.getByText(/existing links unknown/)).toBeTruthy();
    expect(screen.getByText(/Weak passages: 1 of 1/)).toBeTruthy();
    expect(screen.getByText(/Passage 1 \(characters 5–14/)).toBeTruthy();
    const text = prePublishReportText(report, i18n.t);
    expect(text).toContain('Held for human review');
    expect(text).toContain('- https://s.test/b (similarity 70.0%, TRS 80)');
    cleanup();
    render(<PrePublishPanel report={{ ...base, donors: [] }} />);
    expect(screen.getByText('No page meets the donor rule.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }));
  });
});
