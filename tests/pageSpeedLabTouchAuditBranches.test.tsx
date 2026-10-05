import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { PageSpeedLabTouchAudit } from '@/components/Performance/pagespeed/PageSpeedLabTouchAudit';

const audit = (over: object = {}) => ({ score: 1, scoreDisplayMode: 'binary', displayValue: '', title: 'Tap targets', description: 'desc', evidenceCount: 2, evidence: [], evidenceTruncated: false, ...over });
const report = (over: object = {}, a: object | null = {}) => ({ strategy: 'mobile', lighthouseVersion: '12.0.0', touchTargetAudit: a === null ? null : audit(a), ...over });
const ui = (k: string, o?: object) => i18n.t(`pageSpeedUi.${k}`, o);

describe('PageSpeedLabTouchAudit', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('shows the header with strategy and Lighthouse version', () => {
    render(<PageSpeedLabTouchAudit psiReport={report()} />);
    expect(screen.getByText(`MOBILE · ${ui('labData')} · Lighthouse 12.0.0`)).toBeTruthy();
  });

  it('falls back when the version is missing and explains a missing audit', () => {
    render(<PageSpeedLabTouchAudit psiReport={report({ lighthouseVersion: undefined, strategy: 'desktop' }, null)} />);
    expect(screen.getByText(`DESKTOP · ${ui('labData')} · ${ui('versionUnavailable')}`)).toBeTruthy();
    expect(screen.getByText(ui('noTouchAudit'))).toBeTruthy();
    expect(screen.queryByText(ui('desktopTouchNotice'))).toBeNull();
  });

  it.each([
    [1, () => ui('passed'), 'emerald'], [0, () => ui('needsImprovement'), 'rose'],
    [0.5, () => ui('noBinaryVerdict', { mode: 'numeric' }), 'amber'],
  ])('renders the verdict for score %s', (score, label, tone) => {
    render(<PageSpeedLabTouchAudit psiReport={report({}, { score, scoreDisplayMode: 'numeric' })} />);
    expect(screen.getByText(label()).className).toContain(tone);
  });

  it('uses a placeholder when the score display mode is unavailable', () => {
    render(<PageSpeedLabTouchAudit psiReport={report({}, { score: null, scoreDisplayMode: '' })} />);
    expect(screen.getByText(ui('noBinaryVerdict', { mode: ui('scoreUnavailable') }))).toBeTruthy();
  });

  it('prefers displayValue over the title and shows the evidence count and description', () => {
    const { rerender } = render(<PageSpeedLabTouchAudit psiReport={report({}, { displayValue: '3 targets' })} />);
    expect(screen.getByText('3 targets')).toBeTruthy();
    expect(screen.getByText(ui('evidenceCount', { count: 2 }))).toBeTruthy();
    expect(screen.getByText('desc')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    rerender(<PageSpeedLabTouchAudit psiReport={report({}, {})} />);
    expect(screen.getByText('Tap targets')).toBeTruthy();
  });

  it('shows the desktop notice only for non-mobile strategies', () => {
    const { rerender } = render(<PageSpeedLabTouchAudit psiReport={report({ strategy: 'desktop' })} />);
    expect(screen.getByText(ui('desktopTouchNotice'))).toBeTruthy();
    rerender(<PageSpeedLabTouchAudit psiReport={report()} />);
    expect(screen.queryByText(ui('desktopTouchNotice'))).toBeNull();
  });

  it('renders evidence rows with every fallback and the truncation note', () => {
    const evidence = [
      { label: 'Button', selector: '#b', target: '10x10', boundingRect: { w: 1 }, failureSummary: 'too small' },
      { selector: '.s', targetSize: { w: 5 }, explanation: 'why' },
      { snippet: '<a>' },
      {},
    ];
    render(<PageSpeedLabTouchAudit psiReport={report({}, { evidence, evidenceTruncated: true, evidenceCount: 80 })} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Button')).toBeTruthy();
    expect(within(rows[0]).getByText(/10x10/)).toBeTruthy();
    expect(within(rows[0]).getByText('{"w":1}')).toBeTruthy();
    expect(within(rows[0]).getByText('too small')).toBeTruthy();
    expect(within(rows[1]).getAllByText('.s')).toHaveLength(2);
    expect(within(rows[1]).getByText(/\{"w":5\}/)).toBeTruthy();
    expect(within(rows[1]).getByText('why')).toBeTruthy();
    expect(within(rows[2]).getByText(ui('targetNumber', { count: 3 }))).toBeTruthy();
    expect(within(rows[2]).getByText('<a>')).toBeTruthy();
    expect(within(rows[3]).getByText(/—/)).toBeTruthy();
    expect(within(rows[3]).getByText(ui('lighthouseFallback'))).toBeTruthy();
    expect(screen.getByText(ui('firstEvidence', { count: 80 }))).toBeTruthy();
  });
});
