import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { AuthorityPillars } from '@/components/Domain/crawlResults/authority/AuthorityPillars';
import { buildAuthorityReport, type FreshnessReport } from '@/services/topicalAuthority';
import { locales, placeholders, readLeaf } from './fixtures/i18nContracts';
import { NOW, OWN_HOST, ownReport, ownSite } from './authorityFixtures';

const report = buildAuthorityReport(ownSite(), `https://${OWN_HOST}/`, ownReport(), { now: NOW });
const show = (freshness: FreshnessReport) => render(<AuthorityPillars report={{ ...report, freshness }} />);

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('freshness disclosure', () => {
  it('shows the unscored count only beside the freshness component', () => {
    show({ total: 7, dated: 4, undated: 3, ratio: 0.5, stale: ['/stale'] });
    const message = '3 of 7 pages have no date and are not scored';
    expect(within(screen.getByTestId('authority-pillar-cvff')).getByText(message)).toBeTruthy();
    expect(screen.getAllByText(message)).toHaveLength(1);
  });

  it('discloses an entirely undated population without assigning a freshness score', () => {
    show({ total: 2, dated: 0, undated: 2, ratio: null, stale: [] });
    expect(screen.getByText('2 of 2 pages have no date and are not scored')).toBeTruthy();
  });

  it('omits the note when every considered page is dated', () => {
    show({ total: 4, dated: 4, undated: 0, ratio: 1, stale: [] });
    expect(screen.queryByText(/pages have no date and are not scored/)).toBeNull();
  });

  it('loads an old stored report with missing counts defaulting to zero', () => {
    const legacy = JSON.parse('{"ratio":0.5,"dated":2,"stale":["/old"]}') as FreshnessReport;
    show(legacy);
    expect(screen.getByTestId('authority-pillar-cvff')).toBeTruthy();
    expect(screen.queryByText(/pages have no date and are not scored/)).toBeNull();
  });

  it('defaults an independently absent total count to zero', () => {
    show(JSON.parse('{"dated":0,"undated":2,"ratio":null,"stale":[]}') as FreshnessReport);
    expect(screen.getByText('2 of 0 pages have no date and are not scored')).toBeTruthy();
  });

  it.each(locales)('provides both count placeholders in $code without English fallback', ({ code, data }) => {
    const text = readLeaf(data, 'authority.freshness.undated');
    expect(placeholders(text)).toEqual(['total', 'undated']);
    expect(text).toBeTruthy();
    if (code !== 'en') expect(text).not.toBe(readLeaf(locales[0].data, 'authority.freshness.undated'));
  });
});
