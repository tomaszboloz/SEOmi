import { describe, expect, it } from 'vitest';
import { auditTopicLifecycle } from '@/services/topicalAudit/lifecycle';
import { page, topic } from './fixtures/semanticAuditContracts';
import { auditContext } from './fixtures/topicalAuditContext';

const now = new Date('2026-10-02T12:00:00Z');

describe('asserted lifecycle and measured page health', () => {
  it.each(['', '2026-10-01'])('reports an asserted needs-update state with planned date %s', (scheduledDate) => {
    const context = auditContext([page('https://site.test/a', ['coffee'])], [
      { ...topic(['https://site.test/a']), lifecycle: 'needs-update', scheduledDate },
    ]);
    auditTopicLifecycle(context, now);
    expect(context.findings.filter((finding) => finding.code === 'lifecycle-review')).toEqual([
      expect.objectContaining({ provenance: ['asserted'], urls: ['https://site.test/a'], confidence: 'moderate' }),
    ]);
  });

  it('reports overdue drafts and does not call today or future scheduled work overdue', () => {
    const nodes = ['2026-10-01', '2026-10-02', '2026-10-03'].map((scheduledDate, index) => ({
      ...topic([]), id: String(index), lifecycle: 'drafted' as const, scheduledDate,
    }));
    const context = auditContext([], nodes);
    auditTopicLifecycle(context, now);
    expect(context.findings.filter((finding) => finding.code === 'lifecycle-review'))
      .toEqual([expect.objectContaining({ topicId: '0', provenance: ['asserted', 'derived'], urls: [] })]);
  });

  it('uses the exact HTTP 200–299 boundary only for published topics', () => {
    const pages = [199, 200, 299, 300].map((http_status) => page(`https://site.test/${http_status}`, ['coffee'], { http_status }));
    const context = auditContext(pages, [topic(pages.map((entry) => entry.url))]);
    auditTopicLifecycle(context, now);
    expect(context.findings).toEqual([expect.objectContaining({ code: 'topic-url-unhealthy', severity: 'risk',
      urls: ['https://site.test/199', 'https://site.test/300'], confidence: 'moderate' })]);
  });

  it('reports partial and zero topic coverage while skipping complete or empty expectations', () => {
    const pages = [page('https://site.test/partial', ['coffee']), page('https://site.test/zero', [])];
    const context = auditContext(pages, [{ ...topic(pages.map((entry) => entry.url)), title: 'Coffee beans', lifecycle: 'planned' }]);
    auditTopicLifecycle(context, now);
    expect(context.findings.filter((finding) => finding.code === 'topic-not-observed').map((finding) => finding.detail))
      .toEqual([expect.stringContaining('1/2'), expect.stringContaining('0/2')]);
    const empty = auditContext(pages, [{ ...topic(pages.map((entry) => entry.url)), title: 'a 12', lifecycle: 'planned' }]);
    auditTopicLifecycle(empty, now);
    expect(empty.findings).toEqual([]);
  });

  it('tolerates an unmapped topic in a direct audit stage', () => {
    const context = auditContext([], [{ ...topic([]), lifecycle: 'needs-update' }]);
    context.pagesByTopic.clear();
    auditTopicLifecycle(context, now);
    expect(context.findings[0]).toMatchObject({ code: 'lifecycle-review', urls: [] });
  });

  it('retains the measured URL in an overdue draft review', () => {
    const pages = [page('https://site.test/a', ['coffee'])];
    const context = auditContext(pages, [{ ...topic([pages[0].url]), lifecycle: 'drafted', scheduledDate: '2026-10-01' }]);
    auditTopicLifecycle(context, now);
    expect(context.findings).toEqual([expect.objectContaining({ code: 'lifecycle-review', urls: ['https://site.test/a'] })]);
  });
});
