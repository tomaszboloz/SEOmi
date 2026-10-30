import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { BacklinkItem, BacklinkProfileData } from '@/types';
import { buildLinkProfile, LINK_PROFILE_ROWS } from '@/services/offPage/linkProfile';
import { anchorContexts, MAX_ANCHOR_CONTEXTS } from '@/services/offPage/anchorContext';
import type { SourceEvidence } from '@/services/offPage/sources';
import { OffPageAnchorContexts, OffPageLinkProfile } from '@/components/Domain/backlinkChecker/OffPageLinkEvidence';

const link = (source: string, anchor: string, follow = true, target = 'https://me.test/'): BacklinkItem =>
  ({ source_title: '', source_url: source, target_url: target, anchor_text: anchor, is_dofollow: follow, domain_rank: 10, first_seen: '' });
const profile = (backlinks: BacklinkItem[], total = backlinks.length): BacklinkProfileData => ({
  domain: 'me.test', total_backlinks: total, referring_domains: 0, referring_subnets: null, domain_rank: 0, dofollow_ratio: null,
  total_anchor_rows: null, total_backlink_rows: null, anchors: [], backlinks,
});
const source = (sourceUrl: string, text: string, availability: SourceEvidence['availability'] = 'ok'): SourceEvidence =>
  ({ sourceUrl, authority: 10, fetchedAt: null, availability, text, vector: null });
const footer = Array.from({ length: 6 }, (_, i) => link(`https://blog.footer.test/p${i}`, i % 2 ? 'Me Test' : ' me  test '));

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('sitewide link profile (#93)', () => {
  it('keeps raw counts, flags template links and marks a sample', () => {
    const summary = buildLinkProfile(profile([...footer, link('https://a.test/1', 'x', false), link('https://www.a.test/2', 'y'), link('https://c.test/', 'z')], 50));
    expect(summary).toMatchObject({ rawLinks: 9, domains: 3, followDomains: 3, sitewideDomains: 1, repeatedDomains: 1, sample: true });
    expect(summary.sitewideShare).toBeCloseTo(6 / 9);
    expect(summary.rows[0]).toEqual({ domain: 'footer.test', rawLinks: 6, follow: 6, nofollow: 0, sourcePages: 6, targetPages: 1, anchors: 1, pattern: 'sitewide' });
    expect(summary.rows[1]).toMatchObject({ domain: 'a.test', pattern: 'repeated', nofollow: 1 });
    const varied = Array.from({ length: 6 }, (_, i) => link(`https://v.test/${i}`, `anchor ${i}`));
    expect(buildLinkProfile(profile(varied)).rows[0].pattern).toBe('repeated');
    expect(buildLinkProfile(profile([]))).toMatchObject({ rawLinks: 0, sitewideShare: null, sample: false, rows: [] });
    const many = Array.from({ length: LINK_PROFILE_ROWS + 5 }, (_, i) => link(`https://d${i}.test/`, 'a'));
    expect(buildLinkProfile(profile(many)).rows).toHaveLength(LINK_PROFILE_ROWS);
  });
});

describe('anchor context (#93)', () => {
  it('locates provider anchors in fetched text without claiming more than the text shows', () => {
    const data = profile([
      link('https://s.test/a', 'Best Tool'), link('https://s.test/a', 'best tool'), link('https://s.test/a', 'tool'),
      link('https://s.test/a', ''), link('https://s.test/a', 'missing words'), link('https://s.test/b', 'x'), link('https://other.test/', 'y'),
    ]);
    const text = `Intro. We think the best   tool for audits is here. Every tool matters.`;
    const contexts = anchorContexts(data, [source('https://s.test/a', text), source('https://s.test/b', '', 'blocked')]);
    expect(contexts.map((c) => [c.anchor, c.status, c.occurrences])).toEqual([
      ['Best Tool', 'located', 1], ['tool', 'ambiguous', 2], ['', 'no-anchor-text', 0], ['missing words', 'not-found', 0], ['x', 'source-unavailable', 0],
    ]);
    expect(contexts[0]).toMatchObject({ offset: text.indexOf('best'), excerpt: 'Intro. We think the best tool for audits is here. Every tool matters.' });
    const long = `${'a '.repeat(200)}anchor ${'b '.repeat(200)}`;
    expect(anchorContexts(profile([link('https://s.test/a', 'anchor')]), [source('https://s.test/a', long)])[0].excerpt).toMatch(/^….*…$/);
    const flood = profile(Array.from({ length: MAX_ANCHOR_CONTEXTS + 5 }, (_, i) => link('https://s.test/a', `a${i}`)));
    expect(anchorContexts(flood, [source('https://s.test/a', 'text')])).toHaveLength(MAX_ANCHOR_CONTEXTS);
  });
});

describe('off-page link evidence UI', () => {
  it('renders the profile and anchor contexts', () => {
    render(<OffPageLinkProfile profile={profile(footer, 100)} />);
    expect(screen.getByText(/6 raw links from 1 source domains/)).toBeTruthy();
    expect(screen.getByText(/Based on the loaded sample/)).toBeTruthy();
    expect(screen.getByText('Sitewide')).toBeTruthy();
    render(<OffPageAnchorContexts profile={profile([link('https://s.test/a', 'tool', false)])} sources={[source('https://s.test/a', 'a tool and a tool')]} />);
    expect(screen.getByText(/anchor found 2 times \(ambiguous\)/)).toBeTruthy();
    expect(screen.getByText(/nofollow/)).toBeTruthy();
    expect(screen.getByText(/Offset 2:/)).toBeTruthy();
    cleanup();
    render(<OffPageLinkProfile profile={profile([])} />);
    expect(screen.getByText(/Sitewide domains: 0 \(unknown% of raw links\)/)).toBeTruthy();
    render(<OffPageAnchorContexts profile={profile([])} sources={[]} />);
    expect(screen.getByText('No analysed source page has a link in the loaded sample.')).toBeTruthy();
  });
});
