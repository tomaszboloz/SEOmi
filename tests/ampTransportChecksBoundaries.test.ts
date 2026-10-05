import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildAmpAndTransportChecks } from '@/services/auditChecks/accessibilityAndContentChecks';
import type { PageAuditData } from '@/types';

const amp = { detected: true, is_amp_document: true, canonical_url: 'https://a.test/', amphtml_urls: ['https://a.test/amp'], findings: [{ recommendation: 'r' }], unchecked: [] };
const transport = { https: true, scheme: 'https', mixed_content_urls: [], cookies: [{ name: 'sid' }], tls_coverage: 'handshake' };
const statuses = (extra: Record<string, unknown>, finalUrl = 'https://a.test/') => Object.fromEntries(buildAmpAndTransportChecks({ url: finalUrl, final_url: finalUrl, ...extra } as unknown as PageAuditData).map((c) => [c.id, c.status]));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('AMP checks', () => {
  it('marks all not applicable without a report, but never errors on mixed content', () => {
    const s = statuses({});
    expect(s['amp-detected']).toBe('not_applicable');
    expect(s['transport-mixed-content']).toBe('pass');
  });

  it('passes a consistent AMP document', () => {
    const s = statuses({ amp });
    for (const id of ['amp-detected', 'amp-document-consistency', 'amp-canonical', 'amp-alternate-urls', 'amp-findings', 'amp-unchecked']) expect(s[id]).toBe('pass');
  });

  it('handles pages without AMP', () => {
    const s = statuses({ amp: { ...amp, detected: false, is_amp_document: false, amphtml_urls: [], findings: [] } });
    expect([s['amp-detected'], s['amp-document-consistency'], s['amp-canonical'], s['amp-alternate-urls'], s['amp-findings']]).toEqual(['not_applicable', 'pass', 'not_applicable', 'not_applicable', 'not_applicable']);
  });

  it('flags inconsistent detection, missing canonical, relative alternates and findings without advice', () => {
    const s = statuses({ amp: { ...amp, is_amp_document: false, canonical_url: '', amphtml_urls: ['/amp'], findings: [{ recommendation: '' }] } });
    expect([s['amp-document-consistency'], s['amp-alternate-urls'], s['amp-findings']]).toEqual(['warning', 'warning', 'warning']);
    expect(statuses({ amp: { ...amp, canonical_url: '' } })['amp-canonical']).toBe('warning');
  });
});

describe('transport checks', () => {
  it('passes a secure page', () => {
    const s = statuses({ transport_security: transport });
    for (const id of ['transport-scheme', 'transport-https', 'transport-mixed-content', 'transport-cookies', 'transport-tls-coverage', 'transport-cookie-names-only']) expect(s[id]).toBe('pass');
  });

  it('warns when the report scheme disagrees with the final URL or is plain HTTP', () => {
    const s = statuses({ transport_security: { ...transport, https: false } });
    expect([s['transport-scheme'], s['transport-https']]).toEqual(['warning', 'warning']);
    expect(statuses({ transport_security: { ...transport, https: false } }, 'http://a.test/')['transport-scheme']).toBe('pass');
  });

  it('errors on mixed content and warns on nameless cookies or missing TLS coverage', () => {
    const s = statuses({ transport_security: { ...transport, mixed_content_urls: ['http://x'], cookies: [{ name: '' }], tls_coverage: '' } });
    expect([s['transport-mixed-content'], s['transport-cookies'], s['transport-tls-coverage']]).toEqual(['error', 'warning', 'warning']);
  });

  it('treats an empty cookie list as not applicable', () => {
    expect(statuses({ transport_security: { ...transport, cookies: [] } })['transport-cookies']).toBe('not_applicable');
  });
});
