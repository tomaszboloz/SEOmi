import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { AuthorityPillars } from '@/components/Domain/crawlResults/authority/AuthorityPillars';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { COFFEE, NOW, OWN_HOST, coffeePage, ownReport } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const make = (path: string, zones: Array<string | undefined>) => {
  const page = coffeePage(OWN_HOST, { path, title: path, terms: COFFEE, links: zones.map((): [string, string] => ['/a', 'a page']) });
  page.links = page.links.map((link, index) => ({ ...link, zone: zones[index] }));
  return page;
};
beforeEach(() => localStorage.clear());

describe('crawler link placement flags in the SILC report (#110)', () => {
  const pages = [make('/', ['nav_breadcrumb', 'sidebar_footer', 'main']), make('/a', [undefined, 'widget'])];
  const report = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: null, now: NOW });

  it('counts internal links by crawler zone, with unknown meaning no zone data', () => {
    expect(report.silo.linkFlags).toEqual({ menu: 1, sidebarFooter: 1, content: 2, unknown: 1 });
  });

  it('states the flags in the pillar card', () => {
    render(<AuthorityPillars report={report} />);
    expect(screen.getByTestId('authority-pillar-silc').textContent).toContain('1 menu, 1 sidebar/footer, 2 in content, 1 without placement data');
  });

  it('omits the line for older reports without flags', () => {
    render(<AuthorityPillars report={{ ...report, silo: { ...report.silo, linkFlags: undefined } }} />);
    expect(screen.getByTestId('authority-pillar-silc').textContent).not.toContain('placement data');
  });
});
