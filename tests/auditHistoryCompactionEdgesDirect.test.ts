import { describe, expect, it } from 'vitest';
import { compactAuditForHistory } from '@/stores/audit/auditHelpers';
import { createAuditFixture } from './fixtures/audit';

describe('compactAuditForHistory optional evidence contracts', () => {
  it.each([1, 2] as const)('bounds accessibility and AMP evidence at level %s without mutating the source', level => {
    const findings = Array.from({ length: 90 }, (_, i) => ({
      code: `finding-${i}`, severity: 'warning', message: 'Observed issue',
      evidence: `node ${i}`, recommendation: 'Inspect node',
    }));
    const urls = Array.from({ length: 50 }, (_, i) => `https://example.test/${i}`);
    const source = createAuditFixture({
      accessibility: {
        landmarks: [{ name: 'main', count: 1 }], aria_attribute_count: 0,
        form_control_count: 0, unlabeled_form_control_count: 0,
        findings, manual_review_items: urls,
      },
      amp: {
        detected: true, is_amp_document: false, amphtml_urls: urls,
        coverage: 'static', findings, unchecked: urls,
      },
    });
    const snapshot = JSON.stringify(source);
    const compacted = compactAuditForHistory(source, level);
    const issueLimit = level === 1 ? 80 : 16;
    const listLimit = level === 1 ? 40 : 8;
    expect(compacted.accessibility?.findings).toEqual(findings.slice(0, issueLimit));
    expect(compacted.accessibility?.manual_review_items).toEqual(urls.slice(0, issueLimit));
    expect(compacted.accessibility?.landmarks).toEqual([{ name: 'main', count: 1 }]);
    expect(compacted.amp?.amphtml_urls).toEqual(urls.slice(0, listLimit));
    expect(compacted.amp?.findings).toEqual(findings.slice(0, issueLimit));
    expect(compacted.amp?.unchecked).toEqual(urls.slice(0, issueLimit));
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(compacted).not.toBe(source);
  });

  it('preserves absent legacy technical/content fields and optional accessibility findings', () => {
    const source = createAuditFixture({
      accessibility: {
        landmarks: [], aria_attribute_count: 0, form_control_count: 0,
        unlabeled_form_control_count: 0, manual_review_items: ['Review keyboard'],
      },
    });
    Reflect.deleteProperty(source, 'technical');
    Reflect.deleteProperty(source, 'content_stats');
    const compacted = compactAuditForHistory(source, 2);
    expect(compacted.accessibility?.findings).toBeUndefined();
    expect(compacted.accessibility?.manual_review_items).toEqual(['Review keyboard']);
    expect(compacted.technical).toBeUndefined();
    expect(compacted.content_stats).toBeUndefined();
    expect(compacted.amp).toBeUndefined();
  });
});
