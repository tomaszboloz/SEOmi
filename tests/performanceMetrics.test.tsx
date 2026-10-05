import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PerformanceMetrics } from '@/components/Results/PerformanceMetrics';
import { PageAuditData } from '@/types';
import i18n from '@/i18n';

const audit = {
  url: 'https://example.com/',
  final_url: 'https://example.com/',
  timestamp: '2026-09-23T08:00:00.000Z',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  technical: {},
  http_performance: {
    measured_at: '2026-09-23T08:00:00.000Z',
    method: 'GET',
    response_headers_ms: 120,
    body_read_ms: 8,
    total_request_ms: 128,
    decoded_body_bytes: 2048,
    content_length_header_bytes: null,
    redirect_hops: 0,
    scope: 'native_http_get_includes_redirects_no_browser_render',
  },
} as unknown as PageAuditData;

describe('native HTTP performance measurement', () => {
  it('keeps app text selectable even when a component has a select-none utility', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    expect(stylesheet).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*-webkit-user-select:\s*text\s*!important;[^}]*user-select:\s*text\s*!important;/s);
  });

  it('shows measurement scope, timestamp, timings, and keeps absent Content-Length unknown', async () => {
    await i18n.changeLanguage('pl');
    render(<PerformanceMetrics audit={audit} />);

    expect(screen.getByText('Pomiar natywnego żądania HTTP')).toBeTruthy();
    expect(screen.getByText(/To nie jest przeglądarkowy TTFB/)).toBeTruthy();
    expect(screen.getByText('8 ms')).toBeTruthy();
    expect(screen.getByText('128 ms')).toBeTruthy();
    expect(screen.getByText('2048 B')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0 B')).toBeNull();
  });
});
