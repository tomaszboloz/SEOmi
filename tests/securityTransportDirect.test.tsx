import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SecurityTransportSection } from '@/components/Results/securityHeaders/SecurityTransportSection';
import i18n from '@/i18n';

const label = (key: string) => i18n.t(`legacyUi.security.${key}`);
describe('direct transport security evidence', () => {
  it('omits unavailable snapshots and shows no observed cookies or mixed resources', () => {
    const view = render(<SecurityTransportSection transport={undefined} t={i18n.t} />);
    expect(view.container.innerHTML).toBe('');
    view.rerender(<SecurityTransportSection transport={{ scheme: 'https', https: true, mixed_content_urls: [], cookies: [], tls_coverage: 'Observed TLS' }} t={i18n.t} />);
    expect(screen.getByText(label('noMixedHttp'))).toBeTruthy();
    expect(screen.getByText(label('noCookies'))).toBeTruthy();
    expect(view.container.textContent).toContain('HTTPS');
    expect(view.container.textContent).toContain('Observed TLS');
  });
  it('preserves mixed-resource URLs and each measured cookie attribute', () => {
    const view = render(<SecurityTransportSection transport={{ scheme: 'http', https: false,
      mixed_content_urls: ['http://example.test/a.js', 'http://example.test/b.css'],
      cookies: [{ name: 'protected', secure: true, http_only: true, same_site: 'Strict' },
        { name: 'exposed', secure: false, http_only: false, same_site: null }], tls_coverage: 'HTTP observed',
    }} t={i18n.t} />);
    expect(screen.getByText('http://example.test/a.js')).toBeTruthy();
    expect(screen.getByText('http://example.test/b.css')).toBeTruthy();
    const rows = ['protected', 'exposed'].map((name) => screen.getByText(name).parentElement!);
    expect(within(rows[0]).getByText(/Strict/).className).toContain('text-emerald-300');
    expect(rows[0].querySelectorAll('.text-emerald-300')).toHaveLength(3);
    expect(rows[1].querySelectorAll('.text-amber-300')).toHaveLength(3);
    expect(rows[1].textContent).toContain(label('none'));
    expect(view.container.textContent).toContain(label('withoutHttps'));
    expect(screen.getByRole('region', { name: label('transportAria') })).toBeTruthy();
  });
});
