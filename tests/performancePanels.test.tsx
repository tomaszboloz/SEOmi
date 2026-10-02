import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlFilesDiscovery } from '@/components/Results/CrawlFilesDiscovery';
import { RedirectChainWaterfall } from '@/components/Results/RedirectChainWaterfall';
import type { PageAuditData } from '@/types';

beforeEach(async () => { await i18n.changeLanguage('en'); });
const audit = (overrides: Record<string, unknown>) => ({ url: 'http://a.test/', final_url: 'https://www.a.test/', http_status: 200, redirect_chain: [], technical: {}, ...overrides }) as unknown as PageAuditData;

describe('redirect chain waterfall', () => {
  it('reports a direct connection without hops', () => {
    render(<RedirectChainWaterfall audit={audit({})} />);
    expect(screen.getByText(i18n.t('performance.directConnection'))).toBeTruthy();
  });

  it('lists every hop with its status and the final destination', () => {
    render(<RedirectChainWaterfall audit={audit({ redirect_chain: [{ url: 'http://a.test/', status_code: 301 }, { url: 'https://a.test/', status_code: 302 }] })} />);
    expect(screen.getByText(i18n.t('exportUi.statuses.http', { status: 301 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('exportUi.statuses.http', { status: 302 }))).toBeTruthy();
    expect(screen.getByText('https://www.a.test/')).toBeTruthy();
    expect(screen.getByText(i18n.t('exportUi.statuses.http', { status: 200 }))).toBeTruthy();
  });
});

describe('crawl files discovery', () => {
  it('links robots.txt and the sitemap in a new tab without referrer', () => {
    render(<CrawlFilesDiscovery audit={audit({ technical: { robots_txt_url: 'https://a.test/robots.txt', sitemap_url: 'https://a.test/sitemap.xml' } })} />);
    const robots = screen.getByTitle(i18n.t('performance.openRobots'));
    const sitemap = screen.getByTitle(i18n.t('performance.openSitemap'));
    expect(robots.getAttribute('href')).toBe('https://a.test/robots.txt');
    expect(sitemap.getAttribute('href')).toBe('https://a.test/sitemap.xml');
    expect([robots, sitemap].every(link => link.getAttribute('target') === '_blank' && link.getAttribute('rel') === 'noreferrer')).toBe(true);
  });

  it('offers no external links when the locations are unknown', () => {
    render(<CrawlFilesDiscovery audit={audit({})} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
