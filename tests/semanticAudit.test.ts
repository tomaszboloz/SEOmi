import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { buildSemanticAudit } from '@/services/semanticAudit';
import i18n from '@/i18n';
import { page, topic } from "./fixtures/semanticAuditContracts";

describe('buildSemanticAudit', () => {

it('reports partial query coverage with matched and missing token evidence', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/coffee'], [{ id: 'q1', text: 'espresso burr grinder', provenance: 'asserted' }])];

    const report = buildSemanticAudit(document, [page('https://site.test/coffee', ['espresso', 'beans'])]);
    const finding = report.findings.find((item) => item.code === 'query-not-observed');

    expect(finding?.title).toContain(i18n.t('runtimeErrors.semanticAudit.partial'));
    expect(finding?.detail).toContain('1/3');
    expect(finding?.evidence).toContain(i18n.t('runtimeErrors.semanticAudit.matchedTokens', { value: 'espresso' }));
    expect(finding?.evidence).toContain(i18n.t('runtimeErrors.semanticAudit.missingTokens', { value: 'burr, grinder' }));
    expect(finding?.action).toBe(i18n.t('runtimeErrors.semanticAudit.actionQuery'));
  });

it('matches topical assignments across harmless URL formatting differences', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/coffee/'])];

    const report = buildSemanticAudit(document, [page('https://site.test/coffee', ['coffee'])]);

    expect(report.mappedTopics).toBe(1);
    expect(report.findings.some((item) => item.code === 'unmapped-topic')).toBe(false);
    expect(report.findings.some((item) => item.code === 'stale-url-assignment')).toBe(false);
  });

it('surfaces a provider-backed intent mismatch without rewriting the editorial declaration', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/coffee'], [{
      id: 'q-intent',
      text: 'buy espresso grinder',
      provenance: 'dataforseo',
      source: {
        provider: 'DataForSEO Google Ads Keywords for Keywords Live',
        retrievedAt: '2026-09-24T10:00:00.000Z',
        seedKeyword: 'espresso',
        countryCode: 'PL',
        locationCode: 2616,
        languageCode: 'pl',
        searchVolume: 900,
        cpc: 1.2,
        competitionIndex: 42,
        searchIntent: 'transactional',
        monthlySearches: [],
      },
    }])];

    const report = buildSemanticAudit(document, [page('https://site.test/coffee', ['buy', 'espresso', 'grinder'])]);
    const finding = report.findings.find((item) => item.code === 'query-intent-mismatch');

    expect(finding).toMatchObject({
      severity: 'review',
      provenance: ['asserted', 'measured', 'derived'],
      topicId: 'topic-coffee',
      urls: ['https://site.test/coffee'],
      confidence: 'moderate',
    });
    expect(finding?.title).toContain('buy espresso grinder');
    expect(finding?.evidence).toEqual(expect.arrayContaining([
      i18n.t('runtimeErrors.semanticAudit.intentExpected', { value: 'informational' }),
      i18n.t('runtimeErrors.semanticAudit.intentObserved', { value: 'transactional' }),
    ]));
    expect(document.nodes[0].intent).toBe('informational');
  });

it('flags possible overlap only for pages mapped to the same topic with lexical evidence', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/a', 'https://site.test/b'])];
    const pages = [
      page('https://site.test/a', ['espresso', 'coffee', 'grinder', 'beans']),
      page('https://site.test/b', ['espresso', 'coffee', 'grinder', 'beans']),
      page('https://site.test/c', ['espresso', 'coffee', 'grinder', 'beans']),
    ];

    const report = buildSemanticAudit(document, pages);
    const overlap = report.findings.filter((item) => item.code === 'possible-url-overlap');

    expect(overlap).toHaveLength(1);
    expect(overlap[0].urls).toEqual(['https://site.test/a', 'https://site.test/b']);
    expect(overlap[0].provenance).toEqual(['asserted', 'measured', 'derived']);
  });

it('uses the content SimHash candidate index without treating it as confirmed cannibalization', () => {
    const report = buildSemanticAudit(createEmptyTopicalMap(), [
      page('https://site.test/a', [], { content_simhash: '0000000000000000' }),
      page('https://site.test/b', [], { content_simhash: '000000000000007f' }),
    ]);

    expect(report.findings.some((item) => item.code === 'near-duplicate-content')).toBe(true);
    expect(report.findings.some((item) => item.code === 'possible-url-overlap')).toBe(false);
  });

it('surfaces asserted lifecycle updates and published URLs with measured non-2xx status', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [
      topic(['https://site.test/coffee'], []),
      { ...topic([], []), id: 'topic-draft', title: 'Tea guides', lifecycle: 'drafted', scheduledDate: '2026-09-01' },
    ];
    const report = buildSemanticAudit(document, [page('https://site.test/coffee', ['coffee', 'beans'], { http_status: 404 })], new Date('2026-09-23T12:00:00.000Z'));

    expect(report.findings.some((item) => item.code === 'topic-url-unhealthy' && item.evidence.includes('https://site.test/coffee · HTTP 404'))).toBe(true);
    expect(report.findings.some((item) => item.code === 'lifecycle-review' && item.evidence.includes(i18n.t('runtimeErrors.semanticAudit.plannedDate', { value: '2026-09-01' })))).toBe(true);
    expect(report.findings.every((item) => item.action.trim().length > 0)).toBe(true);
  });

it('reports content-only orphan pages without counting navigation links or the crawl root', () => {
    const root = page('https://site.test/', [], {
      depth: 0,
      links: [{ target_url: 'https://site.test/orphan', anchor_text: 'footer link', is_internal: true }],
      semantic_links: [{ target_url: 'https://site.test/source', anchor_text: 'body link', is_internal: true }],
    });
    const orphan = page('https://site.test/orphan', ['rare topic'], { depth: 2 });
    const linked = page('https://site.test/linked', ['related topic'], { depth: 1 });
    const source = page('https://site.test/source', ['source topic'], {
      depth: 1,
      semantic_links: [{ target_url: 'https://site.test/linked#section', anchor_text: 'contextual link', is_internal: true }],
    });

    const report = buildSemanticAudit(createEmptyTopicalMap(), [root, orphan, linked, source]);
    const orphanFinding = report.findings.find((item) => item.code === 'content-orphan-page');

    expect(report.contentOrphanPages).toBe(1);
    expect(orphanFinding?.urls).toEqual(['https://site.test/orphan']);
    expect(orphanFinding?.provenance).toEqual(['measured']);
    expect(orphanFinding?.detail).toContain(i18n.t('runtimeErrors.semanticAudit.orphanDetail'));
    expect(report.findings.some((item) => item.code === 'content-orphan-page' && item.urls.includes(root.url))).toBe(false);
    expect(report.findings.some((item) => item.code === 'content-orphan-page' && item.urls.includes(linked.url))).toBe(false);
  });

it('does not infer content orphans from legacy snapshots without semantic-link data', () => {
    const legacy = page('https://site.test/legacy', ['article'], { depth: 1 });
    delete (legacy as Partial<CrawledPageSummary>).semantic_links;
    const report = buildSemanticAudit(createEmptyTopicalMap(), [legacy]);

    expect(report.contentOrphanPages).toBeNull();
    expect(report.findings.some((item) => item.code === 'content-orphan-page')).toBe(false);
  });
});
