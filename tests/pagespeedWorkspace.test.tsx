import { act, renderHook, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSpeedWorkspace } from '../src/components/Performance/PageSpeedWorkspace';
import { useProjectStore } from '../src/stores/projectStore';

import i18n from '../src/i18n';
import { usePerformanceWorkspace } from '@/components/Performance/usePerformanceWorkspace';

import { project, psiFixture, cruxFixture } from "./fixtures/pagespeedWorkspaceContracts";
const { runPsiMock, queryCruxMock } = vi.hoisted(() => ({ runPsiMock: vi.fn(), queryCruxMock: vi.fn() }));

vi.mock('../src/services/pagespeed', () => ({ runPageSpeedInsights: runPsiMock, queryCrux: queryCruxMock }));

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

it('ignores corrupted persisted reports while keeping valid project inputs', () => {
    localStorage.setItem('seomi_pagespeed_workspace_performance-project', JSON.stringify({
      url: 'https://example.com/landing', strategy: 'desktop',
      pageSpeed: { source: 'broken report' }, crux: { source: 'broken field report' },
    }));
    expect(() => render(<PageSpeedWorkspace />)).not.toThrow();
    expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://example.com/landing');
    expect(screen.getByLabelText('PageSpeed device')).toHaveProperty('value', 'desktop');
    expect(screen.queryByText('Laboratory data — PageSpeed Insights')).toBeNull();
    expect(screen.queryByText('Field data — Core Web Vitals')).toBeNull();
  });

it.each([
    { ...psiFixture, metrics: { lcp: null } },
    { ...psiFixture, opportunities: [{ title: { bad: 'value' } }] },
    { ...psiFixture, touchTargetAudit: { ...psiFixture.touchTargetAudit, evidence: [null] } },
    { ...psiFixture, imageOptimizationAudits: [{ ...psiFixture.imageOptimizationAudits![0], evidence: [null] }] },
  ])('rejects malformed nested persisted Lighthouse data', (pageSpeed) => {
    localStorage.setItem('seomi_pagespeed_workspace_performance-project', JSON.stringify({ pageSpeed, crux: cruxFixture }));
    expect(() => render(<PageSpeedWorkspace />)).not.toThrow();
    expect(screen.queryByText('Laboratory data — PageSpeed Insights')).toBeNull();
    expect(screen.getByText('Field data — Core Web Vitals')).toBeTruthy();
  });

it('reports invalid live Lighthouse output without rendering or saving it', async () => {
    runPsiMock.mockResolvedValue({ source: 'malformed response' });
    const { result } = renderHook(() => usePerformanceWorkspace(project.id, project.rootUrl, i18n.t));
    await act(async () => { await result.current.runPsi(); });
    expect(result.current.psiError).toBe(i18n.t('pageSpeedUi.psiError'));
    expect(result.current.session.pageSpeed).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.isRunningPsi).toBe(false);
  });

it('reports invalid live CrUX output without rendering or saving it', async () => {
    queryCruxMock.mockResolvedValue({ ...cruxFixture, response: [] });
    const { result } = renderHook(() => usePerformanceWorkspace(project.id, project.rootUrl, i18n.t));
    await act(async () => { await result.current.runCrux(); });
    expect(result.current.cruxError).toBe(i18n.t('pageSpeedUi.cruxError'));
    expect(result.current.session.crux).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.isRunningCrux).toBe(false);
  });

it('does not treat an unavailable Lighthouse touch-target audit as a pass', async () => {
    runPsiMock.mockResolvedValue({ ...psiFixture, touchTargetAudit: null, imageOptimizationAudits: [] });
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    expect(await screen.findByText(/Missing results do not indicate a pass/)).toBeTruthy();
    expect(screen.getByText(/No recommendations do not confirm/)).toBeTruthy();
  });
});
