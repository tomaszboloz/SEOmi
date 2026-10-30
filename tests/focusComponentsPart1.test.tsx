import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import i18n from '@/i18n';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';


import { FocusBanners } from '@/components/Domain/crawlResults/focus/FocusBanners';
import { FocusHero } from '@/components/Domain/crawlResults/focus/FocusHero';






import { buildTreeRows, filterCounts, matchesFilter, trsTone } from '@/components/Domain/crawlResults/focus/focusHelpers';
import { codeDetail, codeText, codeTitle } from '@/components/Domain/crawlResults/focus/focusText';
import { diabetesSite } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const report = buildSiteFocusReport(diabetesSite(), START);
const worst = [...report.pages].filter((p) => !p.skipped).sort((a, b) => a.trs - b.trs)[0];

const withFlags = (patch: Partial<SiteFocusReport['flags']>, extra: Partial<SiteFocusReport> = {}): SiteFocusReport => ({ ...report, flags: { ...report.flags, ...patch }, ...extra });

beforeEach(async () => {
  await i18n.changeLanguage('en');
});


describe('helpers', () => {
  it('classifies tones, filters and tree rows', () => {
    expect([trsTone(80), trsTone(65), trsTone(10)]).toEqual(['green', 'yellow', 'red']);
    const page = { trs: 50 } as PageFocus;
    expect([matchesFilter(page, 'all'), matchesFilter(page, 'critical'), matchesFilter(page, 'borderline'), matchesFilter(page, 'strong')]).toEqual([true, false, true, false]);
    expect(filterCounts(report.pages.filter((p) => !p.skipped)).all).toBeGreaterThan(0);
    const rows = buildTreeRows(report.pages.filter((p) => !p.skipped));
    expect(rows.some((row) => row.kind === 'dir')).toBe(true);
    expect(rows.find((row) => row.kind === 'page' && row.depth === 0)).toBeTruthy();
    const odd = buildTreeRows([{ ...worst, url: 'not a url' }, { ...worst, url: 'https://a.test/x/y' }, { ...worst, url: 'https://a.test/x' }]);
    const tie = buildTreeRows([{ ...worst, url: 'https://a.test/x?b=1' }, { ...worst, url: 'https://a.test/x?a=1' }]);
    expect(tie.map((row) => row.key)).toEqual(['https://a.test/x?a=1', 'https://a.test/x?b=1']);
    expect(odd.filter((row) => row.kind === 'dir')).toHaveLength(0);
  });

  it('falls back to the code when a key is missing', () => {
    const t = i18n.t.bind(i18n);
    expect(codeText(t, 'gap', 'nope')).toBe('nope');
    expect(codeTitle(t, 'recommendation', 'nope')).toBe('nope');
    expect(codeDetail(t, 'recommendation', 'nope')).toBe('');
  });
});

describe('FocusBanners', () => {
  it('shows each banner with its message', () => {
    render(<FocusBanners report={withFlags({ isLowConfidence: true, isMultiTopic: true, fallbackMode: 'lexical', skippedRenderTimeouts: 3, degraded: true }, { subSites: [], coreTopic: { ...report.coreTopic, manualOverride: { input: 'zzz', matched: false } } })} />);
    const text = screen.getByTestId('focus-banners').textContent ?? '';
    expect(text).toContain('Small sample');
    expect(text).toContain('topic areas detected');
    expect(text).toContain('TF-IDF statistical algorithm');
    expect(text).toContain('3 pages were skipped in the analysis because JavaScript rendering timed out');
    expect(text).toContain('limited data');
    expect(text).toContain('"zzz"');
  });

  it('renders no banners on a healthy report', () => {
    render(<FocusBanners report={withFlags({ isLowConfidence: false, isMultiTopic: false, fallbackMode: 'semantic', skippedRenderTimeouts: 0, degraded: false })} />);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('handles multi-topic without sub-sites and matched overrides', () => {
    render(<FocusBanners report={withFlags({ isMultiTopic: true }, { subSites: undefined, coreTopic: { ...report.coreTopic, manualOverride: { input: 'ok', matched: true } } })} />);
    expect(screen.getByText(/0 topic areas/)).toBeTruthy();
  });
});

describe('FocusHero', () => {
  it('shows score, bar, summary, metadata, recalc and drawer', () => {
    const onRecalculate = vi.fn();
    render(<FocusHero report={report} onRecalculate={onRecalculate} />);
    expect(screen.getByTestId('focus-score').textContent).toBe(String(report.score));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(report.score));
    fireEvent.click(screen.getByRole('button', { name: 'Analysis details' }));
    expect(screen.getByText(`Pages analysed: ${report.pageCount}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(onRecalculate).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Analysis details' }));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('opens the drawer, closes on Escape, button and backdrop, restoring focus', () => {
    render(<FocusHero report={report} onRecalculate={vi.fn()} />);
    const opener = screen.getByRole('button', { name: 'How does it work?' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText(/0.5 x Similarity/)).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'a' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('focus-drawer-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports change vs history and the all-on-topic summary', () => {
    const snap = { runId: 'r', at: 'x', score: report.score - 4, pageCount: 1, coreTopic: { label: 'a', clusterId: 'b' }, clusterLabels: [], pages: {}, profile: report.profile, coreConfigHash: report.coreConfigHash };
    const clean = { ...report, pages: report.pages.map((p) => ({ ...p, trs: 90 })) };
    const { rerender } = render(<FocusHero report={clean} onRecalculate={vi.fn()} history={[snap]} />);
    expect(screen.getByText(/\+4 points since/)).toBeTruthy();
    expect(screen.getByText(/stay on topic/)).toBeTruthy();
    rerender(<FocusHero report={clean} onRecalculate={vi.fn()} history={[{ ...snap, score: report.score + 2 }]} />);
    expect(screen.getByText(/-2 points since/)).toBeTruthy();
    rerender(<FocusHero report={clean} onRecalculate={vi.fn()} history={[{ ...snap, score: report.score }]} />);
    expect(screen.queryByText(/since the previous/)).toBeNull();
    rerender(<FocusHero report={clean} onRecalculate={vi.fn()} history={[]} />);
    expect(screen.queryByText(/since the previous/)).toBeNull();
    // A snapshot saved before scoring profiles existed is a trend break, never a change (#83).
    rerender(<FocusHero report={clean} onRecalculate={vi.fn()} history={[{ ...snap, profile: undefined, coreConfigHash: undefined }]} />);
    expect(screen.queryByText(/since the previous/)).toBeNull();
    expect(screen.getByTestId('focus-trend-break')).toBeTruthy();
  });

  it('summarises off-topic pages', () => {
    render(<FocusHero report={report} onRecalculate={vi.fn()} />);
    expect(screen.getByText(/deviate significantly/)).toBeTruthy();
  });
});
