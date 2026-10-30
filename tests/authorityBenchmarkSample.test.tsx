import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { AuthorityBenchmark } from '@/components/Domain/crawlResults/authority/AuthorityBenchmark';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { buildTopicalBenchmark } from '@/services/topicalAuthorityReference';
import { COMPETITORS, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const taxonomy = referenceTaxonomy(pages) as NonNullable<ReturnType<typeof referenceTaxonomy>>;
const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('benchmark sample (TOP 3 / 2 / 1 / 0)', () => {
  it('reports the competitors tried in SERP order and the ones without pages', () => {
    const [a, b, c] = COMPETITORS;
    const attempted = ['dead.test', a.domain, b.domain, 'empty.test', c.domain, 'later.test'];
    const empty = { domain: 'empty.test', pages: [] };
    const bench = buildTopicalBenchmark(own, OWN_HOST, [a, b, empty, c], taxonomy, NOW, attempted);
    expect(bench?.sample).toEqual({ attempted: 5, scored: 3, failed: ['dead.test', 'empty.test'] });
    const two = buildTopicalBenchmark(own, OWN_HOST, [a, b], taxonomy, NOW, [a.domain, 'x.test', b.domain]);
    expect(two?.sample).toEqual({ attempted: 3, scored: 2, failed: ['x.test'] });
    expect(buildTopicalBenchmark(own, OWN_HOST, [a], taxonomy, NOW, [a.domain])?.sample).toEqual({ attempted: 1, scored: 1, failed: [] });
    expect(buildTopicalBenchmark(own, OWN_HOST, [], taxonomy, NOW, ['x.test'])).toBeNull();
    expect(buildTopicalBenchmark(own, OWN_HOST, [a], taxonomy, NOW)?.sample).toBeUndefined();
  });

  it('shows provenance, the real sample and failed domains', () => {
    const [a] = COMPETITORS;
    const bench = buildTopicalBenchmark(own, OWN_HOST, [a], taxonomy, NOW, ['dead.test', a.domain]);
    render(<AuthorityBenchmark benchmark={bench} />);
    expect(screen.getByText(/built 2026-10-01/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Compared 1 of 2 competitors tried from the SERP. No usable pages (not scored): dead.test.');
  });
});
