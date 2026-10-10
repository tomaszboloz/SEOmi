import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PerformanceSummaryCards } from '@/components/Results/performanceMetrics/PerformanceSummaryCards';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const t = i18n.t;
describe('measured HTTP summary boundaries', () => {
  it.each([[799, 'fastHttpResponse', 'text-emerald-400'], [800, 'moderateHttpLatency', 'text-amber-400'],
    [1999, 'moderateHttpLatency', 'text-amber-400'], [2000, 'slowHttpResponse', 'text-rose-400']])(
    'classifies %s milliseconds at the actual threshold', (ms, key, style) => {
      render(<PerformanceSummaryCards audit={createAuditFixture({ response_time_ms: Number(ms) })} t={t} />);
      expect(screen.getByText(String(ms)).className).toContain(style);
      expect(screen.getByText(t(`performance.${key}`))).toBeTruthy();
    },
  );
  it('uses measured header timing over the legacy total and preserves server/type observations', () => {
    const audit = createAuditFixture({ response_time_ms: 9000, technical: { hreflang_tags: [], server: 'Observed server', content_type: 'application/xhtml+xml' },
      redirect_chain: [{ url: 'https://example.test', status_code: 301 }],
      http_performance: { measured_at: '2026-10-05', method: 'GET', response_headers_ms: 0, body_read_ms: 9000,
        total_request_ms: 9000, decoded_body_bytes: 12, redirect_hops: 1, scope: 'HTTP only' },
    });
    render(<PerformanceSummaryCards audit={audit} t={t} />);
    expect(screen.getByText('0').className).toContain('text-emerald-400');
    expect(screen.queryByText('9000')).toBeNull();
    expect(screen.getByText('Observed server')).toBeTruthy();
    expect(screen.getByText('application/xhtml+xml')).toBeTruthy();
    expect(screen.getByText(t('performance.redirectsDetected', { count: 1 }))).toBeTruthy();
  });
  it('discloses legacy fallbacks without inventing server evidence', () => {
    render(<PerformanceSummaryCards audit={createAuditFixture({ response_time_ms: 42 })} t={t} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText(t('performance.directConnection'))).toBeTruthy();
    expect(screen.getByText(t('performance.genericServer'))).toBeTruthy();
    expect(screen.getByText(t('performance.htmlContentType'))).toBeTruthy();
  });
});
