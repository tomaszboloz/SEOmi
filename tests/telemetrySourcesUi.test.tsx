import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { ProtectionPanel } from '@/components/Domain/crawlResults/focus/ProtectionPanel';
import { TelemetrySources } from '@/components/Domain/crawlResults/focus/TelemetrySources';
import { buildUrlTelemetrySnapshot, clearSnapshots, putSnapshot, type MeasureState, type SourceProvenance } from '@/services/urlTelemetry';
import type { SiteFocusReport } from '@/services/siteFocus';

const report = { pages: [{ url: 'https://a.test/low', trs: 10 }] } as unknown as SiteFocusReport;
const snapshot = (sources: { gsc: SourceProvenance; ga4: SourceProvenance; backlinks: SourceProvenance }) => ({
  ...buildUrlTelemetrySnapshot({ projectId: 'p', rootUrl: 'https://a.test/', urls: ['https://a.test/low'] })!, sources,
});
const unavailable: SourceProvenance = { state: 'unavailable' };
const labels: Array<[MeasureState, string]> = [
  ['measured', 'Measured'], ['partial-history', 'Partial history'], ['stale', 'Stale'],
  ['sampled', 'Sampled'], ['missing-permission', 'Missing permission'], ['unavailable', 'Unavailable'],
];

beforeEach(async () => { localStorage.clear(); clearSnapshots(); await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); clearSnapshots(); });

describe('localized telemetry sources', () => {
  it.each(labels)('labels %s for every source', (state, label) => {
    render(<TelemetrySources snapshot={snapshot({ gsc: { state }, ga4: { state }, backlinks: { state } })} />);
    expect(screen.getAllByText(label)).toHaveLength(3);
    expect(screen.getByText('GSC')).toBeTruthy();
    expect(screen.getByText('GA4')).toBeTruthy();
    expect(screen.getByText('Backlinks')).toBeTruthy();
  });

  it('shows provenance directly below the protection title without changing its empty state', () => {
    const period = { start: '2026-07-01', end: '2026-10-23', days: 115 };
    putSnapshot(snapshot({
      gsc: { state: 'partial-history', property: 'sc-domain:a.test', provider: 'Google', period, truncated: true },
      ga4: { state: 'stale', property: 'properties/12', period, truncated: false },
      backlinks: { state: 'sampled', provider: 'DataForSEO', retrievedAt: '2026-10-24T08:00:00Z', coveragePct: 20 },
    }));
    render(<ProtectionPanel report={report} projectId="p" />);
    const block = screen.getByTestId('telemetry-sources');
    expect(screen.getByTestId('protection-panel').querySelector('h3')?.nextElementSibling).toBe(block);
    expect(within(block).getByRole('heading', { name: 'Sources' })).toBeTruthy();
    const gsc = within(screen.getByTestId('telemetry-source-gsc'));
    expect(gsc.getByText('Property: sc-domain:a.test')).toBeTruthy();
    expect(gsc.getByText('Provider: Google')).toBeTruthy();
    expect(gsc.getByText('2026-07-01 – 2026-10-23 (115 days)')).toBeTruthy();
    expect(gsc.getByText('Truncated: yes')).toBeTruthy();
    const ga4 = within(screen.getByTestId('telemetry-source-ga4'));
    expect(ga4.getByText('Property: properties/12')).toBeTruthy();
    expect(ga4.getByText('Truncated: no')).toBeTruthy();
    const backlinks = within(screen.getByTestId('telemetry-source-backlinks'));
    expect(backlinks.getByText('Provider: DataForSEO')).toBeTruthy();
    expect(backlinks.getByText('Retrieved: 2026-10-24T08:00:00Z')).toBeTruthy();
    expect(backlinks.getByText('Coverage: 20%')).toBeTruthy();
    expect(within(block).getByText('Unknown data is never counted as zero.')).toBeTruthy();
    expect(screen.queryByTestId('protection-empty')).toBeNull();
  });

  it('keeps all sources unavailable and the existing empty state without a snapshot', () => {
    render(<ProtectionPanel report={report} projectId={null} />);
    expect(screen.getByTestId('protection-empty')).toBeTruthy();
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByText('Unknown data is never counted as zero.')).toBeTruthy();
    expect(screen.getByTestId('telemetry-source-backlinks').querySelectorAll('dd')).toHaveLength(1);
  });

  it('displays a real zero coverage, omits unknown coverage and absent metadata', () => {
    render(<TelemetrySources snapshot={snapshot({
      gsc: { state: 'measured', coveragePct: 0 },
      ga4: { state: 'unavailable', property: '', provider: '', retrievedAt: '', coveragePct: null }, backlinks: unavailable,
    })} />);
    expect(screen.getByText('Coverage: 0%')).toBeTruthy();
    expect(screen.getByTestId('telemetry-source-ga4').querySelectorAll('dd')).toHaveLength(1);
    expect(screen.getByTestId('telemetry-source-backlinks').querySelectorAll('dd')).toHaveLength(1);
    expect(screen.queryByText(/Truncated:/)).toBeNull();
  });
});
