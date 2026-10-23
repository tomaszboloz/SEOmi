import { describe, expect, it } from 'vitest';
import { aggregateTas, buildAuthorityReport, buildContext, buildGapBrief, cosine, unigramKeys, mapCoverage, topicCoverageRatio, contentDepth, pillarCoverage, focusMultiplier, velocityScore, quadrantFor } from '@/services/topicalAuthority';
import { binary, jaccard } from '@/services/topicalAuthority/context';
import { pageDepth, blend } from '@/services/topicalAuthority/depth';
import { ageDays, measureFreshness } from '@/services/topicalAuthority/freshness';
import { countOrigins, isChromeOrigin, linkOrigin } from '@/services/topicalAuthority/chrome';
import { buildAuthorityRecommendations } from '@/services/topicalAuthority/recommend';
import { anchorScore, auditSilo, groupByDirectory } from '@/services/topicalAuthority/silo';
import { isGenericAnchor } from '@/services/topicalAuthority/genericAnchors';
import { resolveQuestions } from '@/services/topicalAuthority/questions';
import { splitTemplates } from '@/services/topicalAuthority/templates';
import { COFFEE, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const start = `https://${OWN_HOST}/`;

describe('coverage100 topical authority primitives', () => {
  it('handles metric clamps, unavailable pillars and quadrant boundaries', () => {
    expect(focusMultiplier(-10)).toBe(0.7);
    expect(focusMultiplier(110)).toBe(1);
    expect(quadrantFor(75, 75)).toBe('dominant_authority');
    expect(quadrantFor(75, 74)).toBe('boutique_specialist');
    expect(velocityScore(null, 0)).toBeGreaterThan(0);
    expect(aggregateTas({ tcr: null, cdes: null, silc: null, cvff: null }, 50)).toMatchObject({ tas: null, tasRaw: null, unavailable: ['tcr', 'cdes', 'silc', 'cvff'] });
    expect(blend([[1, undefined], [2, null]])).toBeNull();
  });

  it('keeps context set operations safe on empty and overlapping inputs', () => {
    expect(unigramKeys('the and of', 'en')).toEqual(new Set());
    expect(binary(['a', 'a'])).toEqual(new Map([['a', 1]]));
    expect(cosine(new Map(), new Map([['x', 1]]))).toBe(0);
    expect(jaccard(new Set(['a']), new Set(['a', 'b']))).toBeCloseTo(0.5);
    expect(jaccard(new Set(), new Set())).toBe(0);
    expect(buildAuthorityReport(ownSite(), start, ownReport(), { now: NOW }).sfs).toBeGreaterThan(0);
  });

  it('maps missing, shallow and strong reference coverage with null aggregates', () => {
    const pages = ownSite();
    const report = buildAuthorityReport(pages, start, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });
    const taxonomy = report.taxonomy!;
    const context = buildContext(pages, start, ownReport(pages));
    const missingTaxonomy = { ...taxonomy, subtopics: [{ id: 'missing', pillar: 'general', label: 'Unknown topic', keys: ['zzzz'], importance: 0.4, entities: ['rare'], questions: [] }] };
    const rows = mapCoverage([], context, missingTaxonomy);
    expect(rows[0]).toMatchObject({ status: 'missing_gap', coverage: 0, gap: 'medium' });
    expect(topicCoverageRatio([])).toBeNull();
    expect(contentDepth([{ ...rows[0], coverage: 0 }])).toBeNull();
    expect(pillarCoverage([], { ...taxonomy, pillars: [{ id: 'general', label: 'General', importance: 1 }] })).toEqual([{ id: 'general', label: 'General', subtopics: 0, coveragePct: 0, gaps: 0, shallow: 0 }]);
  });

  it('covers chrome, generic anchors and question provenance', () => {
    expect(['nav_breadcrumb', 'sidebar_footer', 'main', 'widget', undefined].map(linkOrigin)).toEqual(['menu', 'sidebar_footer', 'content', 'content', 'unknown']);
    expect(isChromeOrigin('menu')).toBe(true);
    expect(isChromeOrigin('content')).toBe(false);
    expect(countOrigins(['main', 'sidebar_footer', null])).toEqual({ menu: 0, sidebarFooter: 1, content: 1, unknown: 1 });
    expect(isGenericAnchor('  !!! ')).toBe(true);
    expect(isGenericAnchor('Espresso machines')).toBe(false);
    expect(resolveQuestions({ paa: ['What is coffee?'], suggestions: ['What is coffee?', 'Why brew?'], headings: ['Why brew?'] }).related).toEqual([{ source: 'google-suggest', question: 'Why brew?' }]);
  });

  it('measures depth, freshness, silo fallbacks and template filtering', () => {
    const pages = ownSite();
    const sfs = ownReport(pages);
    const context = buildContext(pages, start, sfs);
    const entry = context.pages[0];
    expect(pageDepth(entry, { id: 'x', pillar: 'p', label: 'x', keys: [], importance: 1, entities: [], questions: [] }, context, referenceTaxonomy(pages)!)).toMatchObject({ depth: expect.any(Number), present: [], missing: [] });
    expect(ageDays('2020-01-01', NOW)).toBeGreaterThan(365);
    expect(measureFreshness([], NOW)).toEqual({ ratio: null, dated: 0, stale: [] });
    expect(groupByDirectory([entry]).size).toBe(1);
    expect(auditSilo(context, [], new Map()).score).toBeNull();
    expect(anchorScore('click here', entry, context.language)).toBe(0.1);
    expect(splitTemplates(context.pages.slice(0, 2))).toEqual({ representatives: context.pages.slice(0, 2), duplicates: [] });
  });

  it('builds briefs and recommendations for unavailable and empty inputs', () => {
    const pages = ownSite();
    const sfs = ownReport(pages);
    const report = buildAuthorityReport(pages, start, sfs, { now: NOW });
    expect(buildGapBrief({ ...report, taxonomy: null, coverage: [] }, { subtopicId: 'x', pillar: 'general', label: 'Cold brew', importance: 0.2, status: 'missing_gap', coverage: 0, urls: [], similarity: 0, entitiesPresent: [], entitiesMissing: ['water'], questionsMissing: [] })).toMatchObject({ suggestedPath: '/cold-brew', impact: 0 });
    expect(buildAuthorityRecommendations({ coverage: [], pillars: { tcr: null, cdes: null, silc: null, cvff: null }, sfs: 50, silo: report.silo, cannibalization: [], cannibalizationIndex: 0, freshness: report.freshness, pillarLabels: new Map() })).toEqual([]);
    expect(COFFEE.length).toBeGreaterThan(0);
  });
});
