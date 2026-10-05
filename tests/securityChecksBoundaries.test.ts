import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildSecurityChecks } from '@/services/auditChecks/securityAndTechnicalChecks';
import type { PageAuditData } from '@/types';

const fullHeaders = { score: 90, strict_transport_security: 'max-age=1', content_security_policy: "default-src 'self'", x_frame_options: 'DENY', x_content_type_options: 'nosniff', referrer_policy: 'no-referrer', permissions_policy: 'camera=()', cross_origin_opener_policy: 'same-origin', cross_origin_resource_policy: 'same-origin', server: '', x_powered_by: '' };
const cookie = { secure: true, http_only: true, same_site: 'Lax' };
const page = (headers: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ url: 'https://a.test/', final_url: 'https://a.test/', security_headers: { ...fullHeaders, ...headers }, ...extra }) as unknown as PageAuditData;
const statuses = (audit: PageAuditData) => Object.fromEntries(buildSecurityChecks(audit).map((c) => [c.id, c.status]));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('security header checks', () => {
  it('passes a hardened response without disclosure headers', () => {
    expect(Object.values(statuses(page())).filter((s) => s !== 'not_applicable').every((s) => s === 'pass')).toBe(true);
  });

  it.each([[80, 'pass'], [79, 'warning'], [50, 'warning'], [49, 'error'], [0, 'error']])('rates score %i as %s', (score, expected) => {
    expect(statuses(page({ score }))['security']).toBe(expected);
  });

  it('warns on each missing required header and marks optional ones not applicable', () => {
    const s = statuses(page({ strict_transport_security: '', content_security_policy: '', x_frame_options: '', x_content_type_options: '', referrer_policy: '', permissions_policy: '', cross_origin_opener_policy: '', cross_origin_resource_policy: '' }));
    for (const id of ['security-hsts', 'security-csp', 'security-xfo', 'security-xcto', 'security-referrer']) expect(s[id]).toBe('warning');
    for (const id of ['security-permissions', 'security-coop', 'security-corp']) expect(s[id]).toBe('not_applicable');
  });

  it('skips HSTS on plain HTTP and warns on version-disclosing headers', () => {
    const http = { ...page({ strict_transport_security: '' }), final_url: 'http://a.test/' } as PageAuditData;
    expect(statuses(http)['security-hsts']).toBe('not_applicable');
    const s = statuses(page({ server: 'nginx/1.2', x_powered_by: 'PHP/8' }));
    expect([s['security-server-disclosure'], s['security-powered-by']]).toEqual(['warning', 'warning']);
  });

  it('uses the request URL when there is no final URL', () => {
    const audit = { ...page({ strict_transport_security: '' }), final_url: '' } as PageAuditData;
    expect(statuses(audit)['security-hsts']).toBe('warning');
  });

  it('rates cookie flags: none, all safe, and each missing flag', () => {
    expect(statuses(page())['security-cookies']).toBe('not_applicable');
    expect(statuses(page({}, { transport_security: { cookies: [] } }))['security-cookies']).toBe('not_applicable');
    expect(statuses(page({}, { transport_security: { cookies: [cookie] } }))['security-cookies']).toBe('pass');
    for (const bad of [{ secure: false }, { http_only: false }, { same_site: '' }]) {
      expect(statuses(page({}, { transport_security: { cookies: [cookie, { ...cookie, ...bad }] } }))['security-cookies']).toBe('warning');
    }
  });
});
