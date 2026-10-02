import type { TopicalAuditContext } from './types';
import { addFinding, semanticText } from './evidence';

export const auditPageEvidence = (context: TopicalAuditContext) => {
  const { pages, topicsByPage, findings } = context;
  for (const page of pages) {
    const contentEvidence = [
      ...(page.body_truncated ? [semanticText('contentEvidenceTruncated')] : []),
      ...(page.semantic_content_partial ? [semanticText('contentEvidenceBounded')] : []),
      ...(page.semantic_content_source === 'unavailable' ? [semanticText('contentEvidenceUnavailable')] : []),
      ...((page.semantic_excerpts ?? []).length === 0 ? [semanticText('contentEvidenceMissingExcerpts')] : []),
    ];
    if (contentEvidence.length) addFinding(findings, {
      id: `content-evidence-partial-${page.url}`.slice(0, 240), code: 'content-evidence-partial',
      severity: page.body_truncated || page.semantic_content_partial || page.semantic_content_source === 'unavailable' ? 'review' : 'notice',
      provenance: ['measured'], title: semanticText('contentEvidenceTitle', { url: page.url }),
      detail: semanticText('contentEvidenceDetail'), urls: [page.url], evidence: contentEvidence, confidence: 'limited',
    });
    const assigned = topicsByPage.get(page.url) ?? [];
    if (!assigned.length) addFinding(findings, {
      id: `page-unassigned-${page.url}`, code: 'unassigned-page', severity: 'notice', provenance: ['measured'],
      title: semanticText('pageUnassignedTitle'),
      detail: semanticText('pageUnassignedDetail'),
      urls: [page.url], evidence: [semanticText('termCount', { count: (page.semantic_terms ?? []).length })], confidence: 'limited',
    });
    if (assigned.length > 1) addFinding(findings, {
      id: `page-ambiguous-${page.url}`, code: 'ambiguous-page', severity: 'review', provenance: ['asserted', 'measured'],
      title: semanticText('ambiguousTitle'),
      detail: semanticText('ambiguousDetail'),
      urls: [page.url], topicId: assigned[0]?.id, evidence: assigned.map((node) => node.title), confidence: 'limited',
    });
  }

};
