import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildHeaderSpecs } from '@/components/Results/securityHeaders/securityHeadersTypes';
import { SecurityScoreBanner } from '@/components/Results/securityHeaders/SecurityScoreBanner';
import { SecurityTransportSection } from '@/components/Results/securityHeaders/SecurityTransportSection';
import { SecurityDisclosureCards } from '@/components/Results/securityHeaders/SecurityDisclosureCards';
import { SecurityHeadersList } from '@/components/Results/securityHeaders/SecurityHeadersList';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.count !== 'undefined') return `${key}:${opts.count}`;
  return key;
}) as any;

describe('SecurityHeaders modular architecture', () => {
  it('satisfies physical LOC <= 150 across SecurityHeaders and submodules', () => {
    const files = [
      'src/components/Results/SecurityHeaders.tsx',
      ...codeFiles('src/components/Results/securityHeaders'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('buildHeaderSpecs returns 8 header specs', () => {
    const mockHeaders: any = {
      strict_transport_security: 'max-age=31536000',
      content_security_policy: "default-src 'self'",
    };
    const specs = buildHeaderSpecs(mockHeaders, mockT);
    expect(specs.length).toBe(8);
    expect(specs[0].key).toBe('strict-transport-security');
    expect(specs[0].value).toBe('max-age=31536000');
    expect(specs[1].value).toBe("default-src 'self'");
    expect(specs[2].value).toBeUndefined();
  });

  it('surfaces report-only CSP as a distinct observed header', () => {
    const specs = buildHeaderSpecs({
      score: 90,
      content_security_policy_report_only: "default-src 'self'",
    }, mockT);
    expect(specs).toHaveLength(9);
    expect(specs[2].key).toBe('content-security-policy-report-only');
    expect(specs[2].value).toContain("default-src 'self'");
  });

  it('renders SecurityScoreBanner with hardened rating for high score', () => {
    render(<SecurityScoreBanner score={90} t={mockT} />);
    expect(screen.getByText('90%')).toBeTruthy();
    expect(screen.getByText('legacyUi.security.hardened')).toBeTruthy();
  });

  it('renders SecurityTransportSection with mixed content and cookies', () => {
    const mockTransport: any = {
      scheme: 'https',
      https: true,
      mixed_content_urls: ['http://seomi.org/script.js'],
      cookies: [{ name: 'session_id', secure: true, http_only: true, same_site: 'Lax' }],
      tls_coverage: '100% TLS',
    };
    render(<SecurityTransportSection transport={mockTransport} t={mockT} />);
    expect(screen.getByText(/HTTPS/)).toBeTruthy();
    expect(screen.getByText('http://seomi.org/script.js')).toBeTruthy();
    expect(screen.getByText('session_id')).toBeTruthy();
  });

  it('renders SecurityDisclosureCards and detects version leak', () => {
    render(
      <SecurityDisclosureCards
        serverHeader="nginx/1.18.0"
        xPoweredBy="Express"
        t={mockT}
      />,
    );
    expect(screen.getByText('nginx/1.18.0')).toBeTruthy();
    expect(screen.getByText('legacyUi.security.versionLeaked')).toBeTruthy();
    expect(screen.getByText('Express')).toBeTruthy();
    expect(screen.getByText('legacyUi.security.stackLeaked')).toBeTruthy();
  });

  it('renders SecurityHeadersList with cards', () => {
    const specs = buildHeaderSpecs({ strict_transport_security: 'max-age=31536000' } as any, mockT);
    render(<SecurityHeadersList totalCount={specs.length} specs={specs} t={mockT} />);
    expect(screen.getByText('legacyUi.security.defenseHeaders:8')).toBeTruthy();
    expect(screen.getByText('security.hstsTitle')).toBeTruthy();
    expect(screen.getByText('max-age=31536000')).toBeTruthy();
  });
});
