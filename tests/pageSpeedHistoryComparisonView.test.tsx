import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PageSpeedHistoryComparison } from '@/components/Performance/pagespeed/PageSpeedHistoryComparison';
import { formatDelta } from '@/components/Performance/performanceFormatting';
import { appLocale } from '@/services/localeFormat';
import i18n from '@/i18n';

const comparison = {
  baseline: { capturedAt: '2026-09-01T10:00:00Z' },
  current: { capturedAt: '2026-10-01T10:00:00Z' },
  categoryDeltas: [
    { key: 'performance', delta: -5 },
    { key: 'seo', delta: 3 },
    { key: 'accessibility', delta: null },
  ],
  metricDeltas: [
    { id: 'lcp', baseline: 3000, current: 2500, delta: -500 },
    { id: 'cls', baseline: null, current: null, delta: null },
    { id: 'fcp', baseline: null, current: 1200, delta: null },
  ],
  cruxDeltas: [
    { id: 'lcp', baseline: 2400, current: 2200, delta: -200 },
    { id: 'layoutShift', baseline: 0.1, current: 0.05, delta: -0.05 },
    { id: 'inp', baseline: null, current: null, delta: null },
  ],
};

describe('PageSpeedHistoryComparison', () => {
  beforeEach(() => i18n.changeLanguage('en'));

  it('renders nothing without a comparison', () => {
    const { container } = render(<PageSpeedHistoryComparison comparison={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows localized capture dates in the heading meta', () => {
    render(<PageSpeedHistoryComparison comparison={comparison} />);
    expect(screen.getByText(i18n.t('pageSpeedUi.comparisonTitle'))).toBeTruthy();
    const meta = i18n.t('pageSpeedUi.comparisonMeta', {
      baseline: new Date(comparison.baseline.capturedAt).toLocaleString(appLocale()),
      current: new Date(comparison.current.capturedAt).toLocaleString(appLocale()),
    });
    expect(screen.getByText(meta)).toBeTruthy();
  });

  it('colors negative category deltas rose and others emerald, null as a dash', () => {
    render(<PageSpeedHistoryComparison comparison={comparison} />);
    const unit = ` ${i18n.t('pageSpeedUi.pointsUnit')}`;
    expect(screen.getByText(formatDelta(-5, unit)).className).toContain('text-rose-300');
    expect(screen.getByText(formatDelta(3, unit)).className).toContain('text-emerald-300');
    const nullDelta = screen.getByText(i18n.t('pageSpeedUi.categories.accessibility')).nextElementSibling!;
    expect(nullDelta.textContent).toBe('—');
    expect(nullDelta.className).toContain('text-emerald-300');
  });

  it('lists only metrics with data and formats ms deltas', () => {
    render(<PageSpeedHistoryComparison comparison={comparison} />);
    const ms = ` ${i18n.t('pageSpeedUi.ms')}`;
    expect(screen.getByText(formatDelta(-500, ms))).toBeTruthy();
    expect(screen.getByText(i18n.t('pageSpeedUi.metricShort.lcp'))).toBeTruthy();
    expect(screen.getByText(i18n.t('pageSpeedUi.metricShort.fcp'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('pageSpeedUi.metricShort.cls'))).toBeNull();
  });

  it('shows CrUX deltas, omitting the unit for layout metrics and rows without data', () => {
    render(<PageSpeedHistoryComparison comparison={comparison} />);
    const ms = ` ${i18n.t('pageSpeedUi.ms')}`;
    expect(screen.getByText(formatDelta(-200, ms))).toBeTruthy();
    expect(screen.getByText(formatDelta(-0.05))).toBeTruthy();
    expect(screen.queryByText(i18n.t('pageSpeedUi.cruxShort.inp'), { exact: false })).toBeNull();
    expect(screen.getAllByText(i18n.t('uiUnits.percentile75'))).toHaveLength(2);
  });
});
