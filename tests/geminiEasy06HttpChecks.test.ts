import { describe, expect, it } from 'vitest';
import { buildHttpAndUrlChecks } from '@/services/auditChecks/httpAndMetaChecks';
import i18n from '@/i18n';
import { audit } from './fixtures/auditChecksContracts';

const getCheck = (checks: ReturnType<typeof buildHttpAndUrlChecks>, id: string) => checks.find((c) => c.id === id);

describe('buildHttpAndUrlChecks - unknown and error evidence handling', () => {
  it('never yields pass when http status is aborted (0), negative or server error', () => {
    for (const [status, expected] of [[0, 'error'], [-1, 'error'], [502, 'error']] as const) {
      const check = getCheck(buildHttpAndUrlChecks(audit({ http_status: status })), 'http');
      expect(check?.status).toBe(expected);
      expect(check?.evidence).toBe(`HTTP ${status}`);
    }
  });

  it('rejects non-finite and negative response times as error', () => {
    for (const time of [-1, -100, NaN, Infinity, -Infinity]) {
      const check = getCheck(buildHttpAndUrlChecks(audit({ response_time_ms: time })), 'response-time-known');
      expect(check?.status).toBe('error');
      expect(check?.evidence).toBe(String(time));
    }
    expect(getCheck(buildHttpAndUrlChecks(audit({ response_time_ms: 0 })), 'response-time-known')?.status).toBe('pass');
  });

  it('handles missing performance measurement and negative body bytes without false pass', () => {
    const unmeasured = buildHttpAndUrlChecks(audit({ http_performance: undefined }));
    expect(getCheck(unmeasured, 'http-performance')).toMatchObject({
      status: 'not_applicable',
      evidence: i18n.t('auditChecks.evidence.legacyMeasurement'),
    });
    expect(getCheck(unmeasured, 'http-body-size')?.status).toBe('not_applicable');
    expect(getCheck(unmeasured, 'http-redirect-count')?.status).toBe('not_applicable');

    const negativeBytes = buildHttpAndUrlChecks(audit({
      http_performance: {
        measured_at: '2026-10-26T20:00:00Z', method: 'GET', response_headers_ms: 20,
        body_read_ms: 40, total_request_ms: 60, decoded_body_bytes: -1, redirect_hops: 0, scope: 'direct',
      },
    }));
    expect(getCheck(negativeBytes, 'http-body-size')?.status).toBe('error');
  });

  it('flags discrepancy between native redirect hops and redirect chain length', () => {
    const mismatched = buildHttpAndUrlChecks(audit({
      redirect_chain: [],
      http_performance: {
        measured_at: '2026-10-26T20:00:00Z', method: 'GET', response_headers_ms: 20,
        body_read_ms: 40, total_request_ms: 60, decoded_body_bytes: 512, redirect_hops: 2, scope: 'direct',
      },
    }));
    expect(getCheck(mismatched, 'http-redirect-count')).toMatchObject({ status: 'warning', evidence: '2' });
  });
});

describe('buildHttpAndUrlChecks - protocol validation and URL boundaries', () => {
  it('rejects non-HTTP protocols and relative URLs for request and final URLs', () => {
    for (const protoUrl of ['ftp://files.example.com', 'file:///local/path', 'javascript:void(0)', '/relative/path']) {
      const checks = buildHttpAndUrlChecks(audit({ url: protoUrl, final_url: protoUrl }));
      expect(getCheck(checks, 'url-absolute')?.status).toBe('error');
      expect(getCheck(checks, 'final-url-absolute')?.status).toBe('error');
      expect(getCheck(checks, 'https')?.status).toBe('warning');
    }
  });

  it('rejects URLs containing spaces and handles empty URL fallbacks', () => {
    const spaced = buildHttpAndUrlChecks(audit({ url: 'https://example.com/spaced path' }));
    expect(getCheck(spaced, 'url-absolute')?.status).toBe('error');

    const empty = buildHttpAndUrlChecks(audit({ url: '', final_url: '' }));
    expect(getCheck(empty, 'url-absolute')).toMatchObject({
      status: 'error', evidence: i18n.t('auditChecks.evidence.missingRequestUrl'),
    });
    expect(getCheck(empty, 'final-url-absolute')).toMatchObject({
      status: 'error', evidence: i18n.t('auditChecks.evidence.missingFinalUrl'),
    });

    const fallback = buildHttpAndUrlChecks(audit({ url: 'http://example.com/fallback', final_url: '' }));
    expect(getCheck(fallback, 'final-url-absolute')).toMatchObject({ status: 'pass', evidence: 'http://example.com/fallback' });
    expect(getCheck(fallback, 'https')).toMatchObject({ status: 'warning', evidence: i18n.t('auditChecks.evidence.httpsInsecure') });
  });

  it('distinguishes fragment presence and case-insensitive HTTPS schemes', () => {
    const withFrag = buildHttpAndUrlChecks(audit({ url: 'https://example.com/page#section' }));
    expect(getCheck(withFrag, 'url-fragment')).toMatchObject({ status: 'warning', evidence: i18n.t('auditChecks.evidence.urlFragment') });

    const clean = buildHttpAndUrlChecks(audit({ url: 'https://example.com/page' }));
    expect(getCheck(clean, 'url-fragment')).toMatchObject({ status: 'pass', evidence: i18n.t('auditChecks.evidence.noFragment') });

    const upperHttps = buildHttpAndUrlChecks(audit({ final_url: 'HTTPS://EXAMPLE.COM/SECURE' }));
    expect(getCheck(upperHttps, 'https')).toMatchObject({ status: 'pass', evidence: i18n.t('auditChecks.evidence.httpsSecure') });
  });
});

describe('buildHttpAndUrlChecks - redirect anomalies and positive normal control', () => {
  it('detects missing hop locations and non-3xx intermediate redirect statuses', () => {
    const missingLoc = buildHttpAndUrlChecks(audit({
      redirect_chain: [{ url: 'https://example.com/a', status_code: 301, location: '   ' }],
    }));
    expect(getCheck(missingLoc, 'redirect-locations')?.status).toBe('warning');

    const invalidStatus = buildHttpAndUrlChecks(audit({
      redirect_chain: [{ url: 'https://example.com/a', status_code: 0, location: 'https://example.com/b' }],
    }));
    expect(getCheck(invalidStatus, 'redirect-statuses')?.status).toBe('error');
  });

  it('positive normal control satisfies all 14 HTTP and URL checks', () => {
    const normal = buildHttpAndUrlChecks(audit({
      url: 'https://example.com/clean',
      final_url: 'https://example.com/clean',
      http_status: 200,
      response_time_ms: 150,
      redirect_chain: [],
      http_performance: {
        measured_at: '2026-10-26T20:00:00Z', method: 'GET', response_headers_ms: 50,
        body_read_ms: 100, total_request_ms: 150, decoded_body_bytes: 4096, redirect_hops: 0, scope: 'direct',
      },
    }));

    expect(normal).toHaveLength(14);
    expect(normal.every((c) => c.status === 'pass')).toBe(true);
    expect(normal.some((c) => c.status === 'error' || c.status === 'warning')).toBe(false);
  });
});
