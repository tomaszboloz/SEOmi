import { describe, expect, it } from 'vitest';

import { createEmptyTopicalMap } from '@/services/topicalMap';
import { buildSemanticAudit } from '@/services/semanticAudit';
import i18n from '@/i18n';
import { page } from "./fixtures/semanticAuditContracts";

describe('buildSemanticAudit', () => {

it('flags incomplete semantic evidence without treating it as a quality or intent verdict', () => {
    const report = buildSemanticAudit(createEmptyTopicalMap(), [
      page('https://site.test/partial', ['coffee'], { body_truncated: true, semantic_content_source: 'unavailable', semantic_content_partial: true }),
    ]);
    const finding = report.findings.find((item) => item.code === 'content-evidence-partial');

    expect(finding).toMatchObject({
      severity: 'review',
      provenance: ['measured'],
      urls: ['https://site.test/partial'],
      confidence: 'limited',
    });
    expect(finding?.detail).toContain(i18n.t('runtimeErrors.semanticAudit.contentEvidenceDetail'));
    expect(finding?.evidence).toEqual(expect.arrayContaining([
      i18n.t('runtimeErrors.semanticAudit.contentEvidenceTruncated'),
      i18n.t('runtimeErrors.semanticAudit.contentEvidenceUnavailable'),
      i18n.t('runtimeErrors.semanticAudit.contentEvidenceBounded'),
      i18n.t('runtimeErrors.semanticAudit.contentEvidenceMissingExcerpts'),
    ]));
    expect(finding?.action).toBe(i18n.t('runtimeErrors.semanticAudit.actionContentEvidence'));
  });
});
