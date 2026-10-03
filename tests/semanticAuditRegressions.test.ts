import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { buildSemanticAudit } from '@/services/semanticAudit';
import { page, topic } from './fixtures/semanticAuditContracts';

describe('semantic audit measured URL and term evidence', () => {
  it('resolves content links against the source final URL before declaring orphans', () => {
    const report = buildSemanticAudit(createEmptyTopicalMap(), [
      page('https://site.test/old', [], { depth: 0, final_url: 'https://site.test/guides/start',
        semantic_links: [{ target_url: '../target/#section', anchor_text: 'Target', is_internal: true }] }),
      page('https://site.test/target', [], { depth: 1 }),
    ]);
    expect(report.contentOrphanPages).toBe(0);
    expect(report.findings.some((finding) => finding.code === 'content-orphan-page')).toBe(false);
  });

  it('accepts measured content-link snapshots with legacy missing final URLs', () => {
    const report = buildSemanticAudit(createEmptyTopicalMap(), [
      page('https://site.test/', [], { depth: 0, final_url: undefined }),
    ]);
    expect(report.contentOrphanPages).toBe(0);
    expect(report.totalPages).toBe(1);
  });

  it('does not treat blank normalized terms as comparable entity evidence', () => {
    const document = createEmptyTopicalMap();
    document.entity.name = 'Acme';
    const report = buildSemanticAudit(document, [page('https://site.test/', [' ', '!!!', '\u0000'])]);
    expect(report.entityObservability).toEqual([
      { label: 'Acme', observedPages: 0, comparablePages: 0, provenance: 'asserted+measured' },
    ]);
    expect(report.findings.some((finding) => finding.code === 'entity-not-observed')).toBe(false);
  });

  it('maps a topical assignment to its exact request rather than a later redirect alias', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/article'])];
    const report = buildSemanticAudit(document, [
      page('https://site.test/article', ['coffee'], { depth: 0 }),
      page('https://site.test/legacy', ['other'], { final_url: 'https://site.test/article', depth: 1 }),
    ]);
    const unassigned = report.findings.filter((finding) => finding.code === 'unassigned-page');
    expect(unassigned.map((finding) => finding.urls)).toEqual([['https://site.test/legacy']]);
    expect(report.findings.some((finding) => finding.code === 'topic-not-observed')).toBe(false);
  });

  it('keeps all audit responsibilities within 150 physical lines', () => {
    const directory = 'src/services/topicalAudit';
    for (const file of ['src/services/semanticAudit.ts', ...readdirSync(directory).map((name) => `${directory}/${name}`)]) {
      const text = readFileSync(file, 'utf8');
      expect(text.split('\n').length - Number(text.endsWith('\n')), file).toBeLessThanOrEqual(150);
    }
  });

  it('uses entity and fact values rather than inferring them from label punctuation', () => {
    const document = createEmptyTopicalMap();
    document.entity.name = 'Acme: Warsaw';
    document.entity.facts = [{ id: 'city', attribute: 'Location: HQ', value: 'Warsaw', sourceUrl: '', reuseStatus: 'locked' }];
    const report = buildSemanticAudit(document, [page('https://site.test/', ['warsaw'])]);
    expect(report.entityObservability.map((entry) => entry.observedPages)).toEqual([0, 1]);
    expect(report.findings.filter((finding) => finding.code === 'entity-not-observed')).toHaveLength(1);
  });

  it('caps selected pages and findings without inferring orphan counts from a bounded input', () => {
    const pages = Array.from({ length: 5001 }, (_, index) => page(`https://site.test/${index}`, []));
    const report = buildSemanticAudit(createEmptyTopicalMap(), pages);
    expect(report.totalPages).toBe(5000);
    expect(report.findings).toHaveLength(500);
    expect(report.contentOrphanPages).toBeNull();
    expect(report.truncated).toBe(true);
  });
});
