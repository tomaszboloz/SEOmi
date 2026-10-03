import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';
import type { SemanticAuditFinding, SemanticAuditReport } from './topicalAudit/types';
import { MAX_PAGES, MAX_FINDINGS } from './topicalAudit/evidence';
import { auditContentLinks } from './topicalAudit/content';
import { mapTopicalAssignments } from './topicalAudit/mapping';
import { auditTopicLifecycle } from './topicalAudit/lifecycle';
import { auditPageEvidence } from './topicalAudit/pages';
import { auditQueryEvidence } from './topicalAudit/queries';
import { auditEntityObservability } from './topicalAudit/entity';
import { auditPageSimilarity } from './topicalAudit/similarity';

export type { SemanticAuditSignal, SemanticAuditSeverity, SemanticAuditFinding, SemanticAuditReport } from './topicalAudit/types';

/** Lexical overlap is review evidence, never proof of ranking cannibalization. */
export const buildSemanticAudit = (
  document: TopicalMapDocument, inputPages: CrawledPageSummary[], now = new Date(),
): SemanticAuditReport => {
  const pages = inputPages.slice(0, MAX_PAGES);
  const truncated = inputPages.length > MAX_PAGES;
  const findings: SemanticAuditFinding[] = [];
  const contentOrphanPages = auditContentLinks(pages, truncated, findings);
  const { pagesByTopic, topicsByPage } = mapTopicalAssignments(document, pages, findings);
  const context = { document, pages, findings, pagesByTopic, topicsByPage };
  auditTopicLifecycle(context, now);
  auditPageEvidence(context);
  auditQueryEvidence(context);
  const entityObservability = auditEntityObservability(context);
  const pairsTruncated = auditPageSimilarity(context);
  return {
    findings,
    mappedTopics: [...pagesByTopic.values()].filter((matched) => matched.length > 0).length,
    totalTopics: document.nodes.length,
    mappedPages: [...topicsByPage.values()].filter((matched) => matched.length > 0).length,
    totalPages: pages.length, contentOrphanPages, entityObservability,
    truncated: truncated || pairsTruncated || findings.length >= MAX_FINDINGS,
  };
};
