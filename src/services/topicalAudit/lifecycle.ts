import type { TopicalAuditContext } from './types';
import { addFinding, semanticText, termCoverage } from './evidence';
import { isSemanticTopicalStatus } from '@/services/semanticText';

export const auditTopicLifecycle = (context: TopicalAuditContext, now: Date) => {
  const { document, pagesByTopic, findings } = context;
  const today = now.toISOString().slice(0, 10);
  for (const node of document.nodes) {
    const topicPages = pagesByTopic.get(node.id) ?? [];
    if (node.lifecycle === 'needs-update') addFinding(findings, {
      id: `lifecycle-update-${node.id}`, code: 'lifecycle-review', severity: 'review', provenance: ['asserted'],
      title: semanticText('lifecycleTitle', { topic: node.title }),
      detail: semanticText('lifecycleDetail'),
      urls: topicPages.map((page) => page.url).slice(0, 20), topicId: node.id,
      evidence: [semanticText('lifecycle', { value: node.lifecycle }), ...(node.scheduledDate ? [semanticText('plannedDate', { value: node.scheduledDate })] : [])], confidence: 'moderate',
    });
    if (node.scheduledDate && node.scheduledDate < today && node.lifecycle !== 'published' && node.lifecycle !== 'needs-update') addFinding(findings, {
      id: `lifecycle-overdue-${node.id}`, code: 'lifecycle-review', severity: 'review', provenance: ['asserted', 'derived'],
      title: semanticText('overdueTitle', { topic: node.title }),
      detail: semanticText('overdueDetail'),
      urls: topicPages.map((page) => page.url).slice(0, 20), topicId: node.id,
      evidence: [semanticText('lifecycle', { value: node.lifecycle }), semanticText('plannedDate', { value: node.scheduledDate }), semanticText('auditDate', { value: today })], confidence: 'moderate',
    });
    const unhealthy = node.lifecycle === 'published' ? topicPages.filter((page) => page.http_status < 200 || page.http_status >= 300) : [];
    if (unhealthy.length) addFinding(findings, {
      id: `topic-url-unhealthy-${node.id}`, code: 'topic-url-unhealthy', severity: 'risk', provenance: ['asserted', 'measured', 'derived'],
      title: semanticText('unhealthyTitle', { topic: node.title }),
      detail: semanticText('unhealthyDetail'),
      urls: unhealthy.slice(0, 20).map((page) => page.url), topicId: node.id,
      evidence: unhealthy.slice(0, 20).map((page) => semanticText('httpEvidence', { url: page.url, status: page.http_status })), confidence: 'moderate',
    });
    for (const page of topicPages) {
      if (!isSemanticTopicalStatus(page.http_status)) continue;
      const coverage = termCoverage(node.title, page);
      if (!coverage || coverage.matched.length === coverage.expected.length) continue;
      const coveragePercent = Math.round(coverage.matched.length / coverage.expected.length * 100);
      addFinding(findings, {
        id: `topic-unobserved-${node.id}-${page.url}`, code: 'topic-not-observed', severity: 'notice', provenance: ['asserted', 'measured', 'derived'],
        title: semanticText('topicSignal', { prefix: coveragePercent ? semanticText('partial') : semanticText('none'), topic: node.title }),
        detail: semanticText('topicSignalDetail', { matched: coverage.matched.length, expected: coverage.expected.length, percent: coveragePercent }),
        urls: [page.url], topicId: node.id,
        evidence: [semanticText('declaration', { value: node.title }), semanticText('matched', { value: coverage.matched.join(', ') || semanticText('missingTerm') }), semanticText('missing', { value: coverage.expected.filter((term) => !coverage.matched.includes(term)).join(', ') })], confidence: 'limited',
      });
    }
  }

};
