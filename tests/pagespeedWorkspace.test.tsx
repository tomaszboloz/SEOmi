import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSpeedWorkspace } from '../src/components/Performance/PageSpeedWorkspace';
import { useProjectStore } from '../src/stores/projectStore';
import { CruxReport, PageSpeedReport } from '../src/services/pagespeed';
import i18n from '../src/i18n';

const { runPsiMock, queryCruxMock } = vi.hoisted(() => ({ runPsiMock: vi.fn(), queryCruxMock: vi.fn() }));
vi.mock('../src/services/pagespeed', () => ({ runPageSpeedInsights: runPsiMock, queryCrux: queryCruxMock }));

const project = { id: 'performance-project', name: 'Performance project', rootUrl: 'https://example.com/', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' };
const otherProject = { id: 'other-performance-project', name: 'Other performance project', rootUrl: 'https://other.example/', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' };
const psiFixture: PageSpeedReport = {
  source: 'Google PageSpeed Insights API / Lighthouse', requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', strategy: 'mobile', fetchedAt: '2026-09-22T10:00:00.000Z', lighthouseVersion: '12.0.0',
  categories: { performance: 82, accessibility: 100, bestPractices: 96, seo: 100 },
  metrics: { 'largest-contentful-paint': { id: 'largest-contentful-paint', title: 'LCP', displayValue: '2.3 s', numericValue: 2300, score: 0.75 } },
  touchTargetAudit: {
    id: 'target-size', title: 'Target size', description: 'Tap targets are too small or too close together.', score: 0,
    scoreDisplayMode: 'binary', displayValue: '1 target is too small',
    evidence: [{ label: 'Link', selector: 'a:nth-child(2)', snippet: '<a href="/">Link</a>', target: '24x24', targetSize: null, boundingRect: { width: 24, height: 24 }, failureSummary: 'Target is too small', explanation: null }],
    evidenceCount: 1, evidenceTruncated: false,
  },
  imageOptimizationAudits: [{
    id: 'modern-image-formats', title: 'Serve images in next-gen formats', description: 'Image formats can reduce transfer size.',
    score: 0, scoreDisplayMode: 'binary', displayValue: 'Potential savings of 42 KiB', overallSavingsBytes: 43008,
    evidence: [{ url: 'https://example.com/hero.jpg', label: 'Hero image', selector: 'img.hero', snippet: '<img class=hero>', totalBytes: 102400, wastedBytes: 43008, wastedPercent: 42, displayValue: null }],
    evidenceCount: 1, evidenceTruncated: false,
  }],
  opportunities: [], fieldExperience: null, originExperience: null,
};
const cruxFixture: CruxReport = {
  source: 'Chrome UX Report API (CrUX)', fetchedAt: '2026-09-22T10:01:00.000Z', target: 'https://example.com/', scope: 'url', formFactor: 'PHONE',
  response: { record: { key: { url: 'https://example.com/' }, collectionPeriod: { firstDate: { year: 2026, month: 8, day: 26 }, lastDate: { year: 2026, month: 9, day: 22 } }, metrics: { largest_contentful_paint: { category: 'FAST', percentiles: { p75: 2100 }, histogram: [{ density: 0.75 }, { density: 0.2 }, { density: 0.05 }] } } } },
};

describe('PageSpeed and CrUX workspace', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    runPsiMock.mockReset().mockResolvedValue(psiFixture);
    queryCruxMock.mockReset().mockResolvedValue(cruxFixture);
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('pl');
  });

  it('runs Lighthouse and CrUX as distinct sourced tasks and saves both results per project', async () => {
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch field data/ }));
    expect(await screen.findByText(/Chrome UX Report API/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    expect(await screen.findByText('Laboratory data — PageSpeed Insights')).toBeTruthy();
    expect(screen.getByText('Field data — Core Web Vitals')).toBeTruthy();
    expect(screen.getByText('2.3 s')).toBeTruthy();
    expect(screen.getByText('2100 ms')).toBeTruthy();
    expect(screen.getByText('Touch targets — Lighthouse')).toBeTruthy();
    expect(screen.getByText('1 target is too small')).toBeTruthy();
    expect(screen.getByText('Target is too small')).toBeTruthy();
    expect(screen.getByText('Image delivery optimization')).toBeTruthy();
    expect(screen.getByText('Estimated Lighthouse savings: 42.0 KiB. This is a lab estimate, not savings measured after implementation.')).toBeTruthy();
    expect(screen.getByText('https://example.com/hero.jpg')).toBeTruthy();
    expect(runPsiMock).toHaveBeenCalledWith('https://example.com/', 'mobile');
    expect(queryCruxMock).toHaveBeenCalledWith('https://example.com/', 'PHONE', 'url');
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('seomi_pagespeed_workspace_performance-project') || '{}');
      expect(saved.pageSpeed.source).toContain('Lighthouse');
      expect(saved.crux.source).toContain('CrUX');
    });
  });

  it('uses CrUX milliseconds and string CLS percentiles, and keeps null percentiles unknown', async () => {
    queryCruxMock.mockResolvedValue({ ...cruxFixture, response: { record: { metrics: {
      largest_contentful_paint: { percentiles: { p75: 1562 } },
      interaction_to_next_paint: { percentiles: { p75: 137 } },
      cumulative_layout_shift: { percentiles: { p75: '0.00' } },
      first_contentful_paint: { percentiles: { p75: null } },
    } } } });
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch field data/ }));
    expect(await screen.findByText('1562 ms')).toBeTruthy();
    expect(screen.getByText('137 ms')).toBeTruthy();
    expect(screen.getByText('0.000')).toBeTruthy();
    expect(screen.getByText('No p75 percentile')).toBeTruthy();
    expect(screen.getAllByText('Unrated')).toHaveLength(1);
    expect(screen.getAllByText('Good')).toHaveLength(3);
  });


  it.each([
    ['largest_contentful_paint', 2500, 'Good'], ['largest_contentful_paint', 4000, 'Needs improvement'], ['largest_contentful_paint', 4001, 'Poor'],
    ['interaction_to_next_paint', 200, 'Good'], ['interaction_to_next_paint', 500, 'Needs improvement'], ['interaction_to_next_paint', 501, 'Poor'],
    ['cumulative_layout_shift', '0.1', 'Good'], ['cumulative_layout_shift', '0.25', 'Needs improvement'], ['cumulative_layout_shift', '0.251', 'Poor'],
    ['first_contentful_paint', 1800, 'Good'], ['experimental_time_to_first_byte', 1801, 'Poor'],
    ['largest_contentful_paint', '', 'Unrated'], ['largest_contentful_paint', 'invalid', 'Unrated'],
  ])('rates CrUX %s p75 %j using its metric-specific thresholds', async (metric, value, expected) => {
    queryCruxMock.mockResolvedValue({ ...cruxFixture, response: { record: { metrics: { [metric]: { percentiles: { p75: value } } } } } });
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch field data/ }));
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it('restores the saved input, strategy and reports only in the matching project', () => {
    localStorage.setItem('seomi_pagespeed_workspace_performance-project', JSON.stringify({ url: 'https://example.com/landing', strategy: 'desktop', formFactor: 'DESKTOP', scope: 'origin', pageSpeed: psiFixture, crux: cruxFixture }));
    render(<PageSpeedWorkspace />);
    expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://example.com/landing');
    expect(screen.getByLabelText('PageSpeed device')).toHaveProperty('value', 'desktop');
    expect(screen.getByText('Laboratory data — PageSpeed Insights')).toBeTruthy();
  });

  it('does not treat an unavailable Lighthouse touch-target audit as a pass', async () => {
    runPsiMock.mockResolvedValue({ ...psiFixture, touchTargetAudit: null, imageOptimizationAudits: [] });
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    expect(await screen.findByText(/Missing results do not indicate a pass/)).toBeTruthy();
    expect(screen.getByText(/No recommendations do not confirm/)).toBeTruthy();
  });

  it('does not leak a delayed PageSpeed error into a newly selected project', async () => {
    let rejectPsi: ((error: Error) => void) | undefined;
    runPsiMock.mockImplementation(() => new Promise<PageSpeedReport>((_resolve, reject) => { rejectPsi = reject; }));
    useProjectStore.setState({ projects: [project, otherProject], activeProjectId: project.id });
    render(<PageSpeedWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    useProjectStore.setState({ activeProjectId: otherProject.id });
    await waitFor(() => expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://other.example/'));

    rejectPsi?.(new Error('stale PageSpeed failure'));
    await waitFor(() => expect(screen.queryByText('stale PageSpeed failure')).toBeNull());
    expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://other.example/');
  });

  it('discards a delayed PageSpeed result after the requested URL changes', async () => {
    let resolvePsi: ((report: PageSpeedReport) => void) | undefined;
    runPsiMock.mockImplementation(() => new Promise<PageSpeedReport>((resolve) => { resolvePsi = resolve; }));
    render(<PageSpeedWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    fireEvent.change(screen.getByLabelText('Page URL'), { target: { value: 'https://example.com/new-page' } });
    resolvePsi?.({ ...psiFixture, requestedUrl: 'https://example.com/' });
    await waitFor(() => expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://example.com/new-page'));
    expect(screen.queryByText('Laboratory data — PageSpeed Insights')).toBeNull();
    expect(screen.getByRole('button', { name: /Run PageSpeed/ })).toHaveProperty('disabled', false);
  });
});
