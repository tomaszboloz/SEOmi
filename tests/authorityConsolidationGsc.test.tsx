import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { CannibalGroupEvidence } from '@/components/Domain/crawlResults/authority/CannibalGroupEvidence';
import type { FocusPage } from '@/services/siteFocus';
import { gscEvidenceFor, uniqueTermsByUrl, urlIdentity, type CannibalGroup } from '@/services/topicalAuthority';

const A = 'https://shop.test/espresso/';
const B = 'https://shop.test/espresso-guide';
const C = 'https://shop.test/espresso-tips';
const group: CannibalGroup = { urls: [A, B, C], canonical: A, similarity: 91, sharedEntitiesPct: 80, edges: [] };
const row = (query: string, page: string, clicks: number, impressions: number) => ({ query, page, clicks, impressions, ctr: 0, position: 3 });
const page = (url: string, terms: string[]) => ({ url, focus_terms: terms.map((term, index) => ({ term, surface: term, count: 2, weight: 10 - index })) }) as unknown as FocusPage;

describe('GSC evidence for a cannibalization group (#59 GEM-59-04, D02)', () => {
  it('is unavailable without saved query/page rows', () => {
    expect(gscEvidenceFor(group, null)).toMatchObject({ status: 'unavailable', leader: null, conflict: false });
    expect(gscEvidenceFor(group, { query_pages_may_be_truncated: true })).toMatchObject({ status: 'unavailable', truncated: true });
  });

  it('reports no overlap when group URLs never share a query or rows belong elsewhere', () => {
    const data = { query_pages: [row('espresso', A, 5, 50), row('grinder', B, 3, 30), row('espresso', 'https://other.test/', 9, 90), row('espresso', C, 0, 0)] };
    expect(gscEvidenceFor(group, data)).toMatchObject({ status: 'no-overlap', queries: [] });
  });

  it('agrees with the content canonical when it leads clicks (URL variants matched)', () => {
    const data = { query_pages: [row('espresso', 'https://WWW.shop.test/espresso', 20, 200), row('espresso', B, 4, 100), row('espresso', A, 1, 10)] };
    const evidence = gscEvidenceFor(group, data);
    expect(evidence).toMatchObject({ status: 'available', leader: A, conflict: false });
    expect(evidence.queries[0].pages[0]).toEqual({ url: A, clicks: 21, impressions: 210 });
  });

  it('flags a conflict for human review when GSC prefers another URL; ties fall back to impressions', () => {
    const data = { query_pages: [row('q1', A, 2, 40), row('q1', B, 2, 90), row('q2', C, 0, 5), row('q2', A, 0, 5)], query_pages_may_be_truncated: true };
    const evidence = gscEvidenceFor(group, data);
    expect(evidence).toMatchObject({ leader: B, conflict: true, truncated: true });
    expect(evidence.queries.map((item) => item.query)).toEqual(['q1', 'q2']);
  });

  it('normalizes URL identity and keeps unparsable input', () => {
    expect(urlIdentity('https://www.Shop.test/a/')).toBe(urlIdentity('https://shop.test/a'));
    expect(urlIdentity(' not a url/ ')).toBe('not a url');
  });
});

describe('unique content per URL', () => {
  it('lists terms found only on each page and nothing for pages without own terms', () => {
    const pages = [page(A, ['espresso', 'crema', 'pressure']), page(B, ['espresso', 'crema', 'tamping']), page(C, ['espresso'])];
    expect(uniqueTermsByUrl(group, pages, 'en')).toEqual({ [A]: ['pressure'], [B]: ['tamping'], [C]: [] });
    expect(uniqueTermsByUrl(group, [], 'en')).toEqual({ [A]: [], [B]: [], [C]: [] });
  });

  it('renders conflict, queries, truncation and unique content', () => {
    const pages = [page(A, ['pressure']), page(B, []), page(C, [])];
    const view = render(<CannibalGroupEvidence group={group} pages={pages} language="en" gsc={{ query_pages: [row('q1', A, 1, 10), row('q1', B, 5, 20)], query_pages_may_be_truncated: true }} />);
    expect(screen.getByRole('note').textContent).toMatch(/Conflict to review/);
    expect(screen.getByText(/“q1”/).textContent).toMatch(/5 clicks/);
    expect(screen.getByText(/may be truncated/)).toBeTruthy();
    expect(screen.getByText(/pressure/)).toBeTruthy();
    expect(screen.getAllByText(/no terms found only on this page/)).toHaveLength(2);
    view.rerender(<CannibalGroupEvidence group={group} pages={pages} gsc={null} />);
    expect(screen.getByText(/no saved query\/page data/)).toBeTruthy();
    view.rerender(<CannibalGroupEvidence group={group} pages={pages} gsc={{ query_pages: [] }} />);
    expect(screen.getByText(/do not receive impressions/)).toBeTruthy();
    view.rerender(<CannibalGroupEvidence group={group} pages={pages} gsc={{ query_pages: [row('q1', A, 9, 10), row('q1', B, 1, 20)] }} />);
    expect(screen.getByText(/Search Console agrees/)).toBeTruthy();
  });
});
