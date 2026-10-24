import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { PrePublishPanel } from '@/components/Charts/PrePublishPanel';
import type { PrePublishReport } from '@/services/prePublish/check';
import { prePublishReportText } from '@/services/prePublish/reportText';

const copy = vi.hoisted(() => vi.fn());
vi.mock('@/services/clipboard', () => ({ copyText: copy }));

const base: PrePublishReport = { verdict: 'insufficient', publishApproved: false, draftTrs: null, sfsBefore: null, sfsAfter: null, sfsDelta: null, conflicts: [], chunkIssues: [], reasons: [] };
const full: PrePublishReport = {
  ...base, verdict: 'blocked', draftTrs: 71, sfsBefore: 60, sfsAfter: 58.5, sfsDelta: -1.5, reasons: ['cannibalization'],
  conflicts: [{ url: 'https://a.test/x', similarity: 0.912, level: 'conflict' }, { url: 'https://a.test/y', similarity: 0.86, level: 'overlap' }],
  chunkIssues: [{ index: 1, kind: 'too-short' }],
} as never;

beforeEach(async () => { copy.mockReset(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('prePublishReportText', () => {
  const t = i18n.t.bind(i18n) as never;

  it('writes the verdict, signed negative delta, reasons, conflicts and chunk issues', () => {
    const lines = prePublishReportText(full, t).split('\n');
    expect(lines[0]).toBe('Pre-publish check');
    expect(lines[1]).toBe('Do not publish yet: the draft duplicates an existing page.');
    expect(lines[2]).toContain('60 to 58.5 (-1.5)');
    expect(lines).toContain('- Cannibalization risk.');
    expect(lines).toContain('- Too similar to https://a.test/x (91.2%).');
    expect(lines).toContain('- Overlaps with https://a.test/y (86.0%).');
    expect(lines.at(-1)).toMatch(/^- /);
  });

  it('signs a positive delta with + and leaves out the SFS line without evidence', () => {
    expect(prePublishReportText({ ...full, sfsBefore: 60, sfsAfter: 62, sfsDelta: 2 } as never, t)).toContain('(+2)');
    const empty = prePublishReportText({ ...base, reasons: ['no-core'] }, t);
    expect(empty).not.toContain('Site Focus Score');
    expect(empty.split('\n')).toEqual(['Pre-publish check', 'Not enough data to judge this draft.', '- No Core Topic yet.']);
  });
});

describe('copy button', () => {
  it('copies the plain-text card and confirms', async () => {
    copy.mockResolvedValue(true);
    render(<PrePublishPanel report={full} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }));
    await waitFor(() => expect(screen.getByText('Report copied.')).toBeTruthy());
    expect(copy).toHaveBeenCalledWith(prePublishReportText(full, i18n.t.bind(i18n) as never));
  });

  it('reports a failed copy', async () => {
    copy.mockResolvedValue(false);
    render(<PrePublishPanel report={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }));
    await waitFor(() => expect(screen.getByText('Could not copy the report.')).toBeTruthy());
  });
});

describe('translations', () => {
  it('has the copy strings in every locale', async () => {
    for (const locale of ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh']) {
      const block = (await import(`@/i18n/locales/${locale}.json`)).default.prePublishUi;
      for (const key of ['copy', 'copied', 'copyFailed']) expect(typeof block[key], `${locale}.${key}`).toBe('string');
      if (locale !== 'en') expect(block.copy, locale).not.toBe('Copy report');
    }
  });
});
