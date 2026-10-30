import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProtectionRow } from '@/components/Domain/crawlResults/focus/ProtectionRow';
import { ProtectionPanel } from '@/components/Domain/crawlResults/focus/ProtectionPanel';
import type { SiteFocusReport } from '@/services/siteFocus';
import { decideProtection } from '@/services/urlProtection';
import type { UrlTelemetry } from '@/services/urlTelemetry';

afterEach(cleanup);

const miss = { state: 'unavailable', value: null } as const;
const measured: UrlTelemetry = {
  url: 'https://a.com/x',
  gsc: { state: 'measured', value: { clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false } },
  ga4: { state: 'measured', value: { sessions: 0, engagedSessions: 0, keyEvents: 0 } },
  backlinks: { state: 'stale', value: { referringDomains: 0 } },
  revenue: { state: 'measured', value: { amount: 0, currency: 'PLN' } },
};

describe('ProtectionRow', () => {
  it('lists every reason, the raw evidence with states and unknowns, and no advice for protected pages', () => {
    const result = decideProtection(5, { ...measured, gsc: miss, ga4: { state: 'measured', value: { sessions: 1, engagedSessions: 1, keyEvents: 2 } } });
    render(<ProtectionRow url="https://a.com/x" result={result} />);
    expect(screen.getByText('focus.protection.reason.conversions')).toBeTruthy();
    const evidence = screen.getByTestId('protection-evidence').textContent ?? '';
    expect(evidence).toContain('focus.protection.unknown');
    expect(evidence).toContain('focus.protection.measured');
    expect(evidence).toContain('(telemetrySourcesUi.states.stale)');
    expect(screen.queryByRole('list', { name: 'focus.protection.alternativesLabel' })).toBeNull();
  });

  it('shows each manual alternative with its conditions for a measured low-value page', () => {
    const result = decideProtection(5, { ...measured, backlinks: { state: 'measured', value: { referringDomains: 0 } } });
    expect(result.decision).toBe('prune-candidate');
    render(<ProtectionRow url="https://a.com/x" result={result} />);
    expect(screen.getByTestId('protection-advice-redirect-301-to-relevant-target').textContent).toContain('focus.protection.alternative.redirect-301-to-relevant-target');
    expect(screen.getByTestId('protection-advice-noindex-or-410-after-review').textContent).toContain('focus.protection.onlyIf');
  });

  it('marks a revenue amount without a currency instead of guessing one', () => {
    const result = decideProtection(5, { ...measured, revenue: { state: 'measured', value: { amount: 7, currency: '' } } });
    render(<ProtectionRow url="https://a.com/x" result={result} />);
    expect(screen.getByTestId('protection-evidence').textContent).toContain('focus.protection.measured');
    expect(result.evidence.at(-1)).not.toHaveProperty('currency');
    expect(screen.getByTestId('protection-advice-confirm-revenue-currency')).toBeTruthy();
  });
});

describe('ProtectionPanel rule', () => {
  it('states the inclusive threshold rule next to the advisory note', () => {
    const report = { pages: [{ url: 'https://a.com/x', trs: 10 }] } as unknown as SiteFocusReport;
    render(<ProtectionPanel report={report} projectId={null} />);
    expect(screen.getByTestId('protection-rule').textContent).toBe('focus.protection.rule');
    expect(screen.getAllByTestId('protection-row')).toHaveLength(1);
  });
});
