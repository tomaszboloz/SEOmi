import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { buildLinksChecks } from '@/services/auditChecks/mediaAndLinksChecks';
import { estimateImpact } from '@/services/causalMarket/impact';
import { summarizeAuthority } from '@/services/export/authoritySummary';
import { downloadPdf } from '@/services/export/download';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import { chunkIssues } from '@/services/prePublish/chunks';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { multiTopicSite } from './siteFocusFixtures';
import { NOW, ownReport, ownSite } from './authorityFixtures';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn().mockResolvedValue(btoa('%PDF-1.7')) }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));

const audit = (patch: Record<string, unknown> = {}) => ({
  url: 'https://example.test/', final_url: 'https://example.test/', http_status: 200, response_time_ms: 100, redirect_chain: [],
  meta_tags: { title: 'A title that is long enough', title_length: 28, description: 'A description', description_length: 13, viewport: 'width=device-width' },
  indexability: { status: 'indexable', reasons: [], canonical_target_checked: true, canonical_target_status: 0 }, ...patch,
}) as never;

describe('coverage 100 audit, export and pre-publish edges', () => {
  it('uses the translated fallback for an unchecked canonical status', () => {
    expect(buildMetaAndIndexabilityChecks(audit()).find((check) => check.id === 'canonical-target-status')).toMatchObject({ status: 'error' });
  });

  it('reports an impossible fragment count as an error without changing link evidence', () => {
    const links = [{ href: 'https://example.test/a', is_internal: true }];
    Object.defineProperty(links, 'filter', { configurable: true, value: () => [...links, ...links] });
    const checks = buildLinksChecks(audit({ links: { total_links: 1, internal_links: 1, external_links: 0, nofollow_links: 0, links } }));
    expect(checks.find((check) => check.id === 'links-fragments')?.status).toBe('error');
  });

  it('computes a relative effect when the post-period expectation is non-zero', () => {
    const dates = Array.from({ length: 8 }, (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}`);
    const result = estimateImpact({ dates, test: [1, 2, 3, 4, 5, 6, 7, 3], control: [1, 2, 3, 4, 5, 6, 7, 2], market: null, interventionDate: dates[7], updateWindows: [] });
    expect(result?.relativeEffect).toBe(0.5);
  });

  it('sorts equal-weight authority gaps in both label directions', () => {
    const pages = ownSite();
    const base = buildAuthorityReport(pages, 'https://coffee.test/', ownReport(pages), { now: NOW });
    const first = base.coverage[0] ?? { subtopicId: 'x', pillar: 'general', status: 'missing_gap' as const, urls: [], similarity: 0, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] };
    const report = { ...base, coverage: [{ ...first, label: 'zulu', coverage: 0 as const, importance: 0.5 }, { ...first, label: 'alpha', coverage: 0 as const, importance: 0.5 }] };
    expect(summarizeAuthority(report, []).gaps.map((gap) => gap.label)).toEqual(['alpha', 'zulu']);
    expect(summarizeAuthority({ ...report, coverage: [...report.coverage].reverse() }, []).gaps.map((gap) => gap.label)).toEqual(['alpha', 'zulu']);
  });

  it('summarizes sub-sites and gaps when they are present', () => {
    const report = buildSiteFocusReport(multiTopicSite(), 'https://shop.test/', { now: NOW });
    const summary = summarizeSiteFocus(report);
    expect(summary.sub_sites.length).toBeGreaterThan(0);
    expect(summary.gaps).toEqual(report.gaps.map((gap) => expect.objectContaining({ code: gap.code })));
    expect(summarizeSiteFocus({ ...report, gaps: [{ code: 'thin-subtopic', label: 'Gap', terms: ['term'], coveragePct: 0, pagesCovering: 0 }] }).gaps).toHaveLength(1);
  });

  it('uses an empty PDF label bundle when the active locale has no resource', async () => {
    const getResource = vi.spyOn(i18n, 'getResource').mockReturnValue(undefined as never);
    await downloadPdf('generate_audit_pdf', { audit: { url: 'https://example.test/' } }, 'audit.pdf');
    expect(getResource).toHaveBeenCalled();
  });

  it('flags long enough chunks only for their leading context', () => {
    const complete = Array.from({ length: 20 }, (_, index) => `word${index}`).join(' ');
    expect(chunkIssues([complete, 'It is too short.'])).toEqual([{ index: 1, kind: 'leading-pronoun' }, { index: 1, kind: 'too-short' }]);
    expect(chunkIssues(['!!!'])).toEqual([{ index: 0, kind: 'too-short' }]);
  });
});
