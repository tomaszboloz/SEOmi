import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { pageSpeedHistoryStorageKey } from '@/services/pagespeedHistory';
import { PageSpeedWorkspace } from '@/components/Performance/PageSpeedWorkspace';
import { PageSpeedLab } from '@/components/Performance/pagespeed/PageSpeedLab';
import { PageSpeedLabOpportunities } from '@/components/Performance/pagespeed/PageSpeedLabOpportunities';
import { PageSpeedField } from '@/components/Performance/pagespeed/PageSpeedField';
import { project, psiFixture } from './fixtures/pagespeedWorkspaceContracts';
import { historySnapshot } from './fixtures/pageSpeedHistory';

vi.mock('@/components/Charts/TrendChart', () => ({ TrendChart: () => <div data-testid="trend-chart" /> }));

const originalProject = useProjectStore.getState();
const originalLanguage = i18n.language;

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  useProjectStore.setState({ projects: [project], activeProjectId: project.id });
});
afterEach(async () => {
  cleanup();
  useProjectStore.setState(originalProject, true);
  await i18n.changeLanguage(originalLanguage);
});

describe('PageSpeed lab boundary states', () => {
  it('shows explicit fallbacks for missing API time, Lighthouse version and field category', () => {
    const view = render(<PageSpeedLab psiReport={{ ...psiFixture, fetchedAt: '', lighthouseVersion: undefined, fieldExperience: {} }} />);
    expect(screen.getByText(/API time unavailable/)).toBeTruthy();
    expect(screen.getByText(/PSI field data included: Not enough real-user data/)).toBeTruthy();
    view.unmount();
    render(<PageSpeedLab psiReport={{ ...psiFixture, fetchedAt: '2026-10-01T00:00:00Z', fieldExperience: null }} />);
    expect(screen.queryByText(/PSI field data included:/)).toBeNull();
  });

  it('renders opportunity display, diagnostic and percentage fallbacks', () => {
    render(<PageSpeedLabOpportunities psiReport={{ opportunities: [
      { id: 'display', title: 'Display value', description: 'See [docs](https://example.test/docs)', displayValue: '1.2 s', score: null },
      { id: 'diagnostic', title: 'Diagnostic', description: 'Plain description', displayValue: '', score: null },
      { id: 'score', title: 'Score', description: 'Another description', displayValue: null, score: 0.876 },
    ] }} />);
    expect(screen.getByText('1.2 s')).toBeTruthy();
    expect(screen.getByText('diagnostic')).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'docs' }).getAttribute('href')).toBe('https://example.test/docs');
  });
});

describe('PageSpeed field boundary states', () => {
  const session = { crux: { source: 'CrUX', scope: 'url', formFactor: 'PHONE', fetchedAt: '2026-10-01T00:00:00Z' } };

  it('explains when CrUX has no metrics or collection window', () => {
    render(<PageSpeedField session={session} cruxMetrics={null} collectionPeriod={null} />);
    expect(screen.getByRole('alert').textContent).toContain('Google returned a record without metrics');
    expect(screen.getByText('API collection period')).toBeTruthy();
  });

  it('renders invalid and zero-density histograms without inventing values', () => {
    render(<PageSpeedField session={session} collectionPeriod="2026-09-01 – 2026-09-28" cruxMetrics={{
      largest_contentful_paint: { percentiles: { p75: 2500 }, histogram: [{ density: 0 }, { density: 0.5 }, { density: 1 }] },
      unknown_metric: { percentiles: { p75: 1 }, histogram: 'invalid' },
    }} />);
    expect(screen.getByText('2500 ms')).toBeTruthy();
    expect(screen.getByText('Good')).toBeTruthy();
    expect(screen.getByText('0% / 50% / 100%')).toBeTruthy();
    expect(screen.getByText('No histogram')).toBeTruthy();
    expect(screen.getByText('Window: 2026-09-01 – 2026-09-28')).toBeTruthy();
  });
});

describe('PageSpeed workspace boundaries', () => {
  it('passes an empty default URL and computes a selected baseline comparison', () => {
    useProjectStore.setState({ projects: [], activeProjectId: null });
    const empty = render(<PageSpeedWorkspace />);
    expect(empty.getByLabelText('Page URL')).toHaveProperty('value', '');
    empty.unmount();
    const baseline = historySnapshot({ id: 'baseline', capturedAt: '2026-10-01T00:00:00Z' });
    const current = historySnapshot({ id: 'current', capturedAt: '2026-10-02T00:00:00Z' });
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    localStorage.setItem(pageSpeedHistoryStorageKey(project.id), JSON.stringify([baseline, current]));
    render(<PageSpeedWorkspace />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Baseline snapshot for comparison' }), { target: { value: 'baseline' } });
    expect(screen.getByText('Snapshot comparison')).toBeTruthy();
  });
});
