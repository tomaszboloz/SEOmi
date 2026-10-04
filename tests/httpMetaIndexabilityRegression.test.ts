import { describe, expect, it } from 'vitest';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { getMetadataProblems } from '@/services/auditProblems';
import { createAuditFixture } from './fixtures/audit';

const withRobots = (robots: string) => {
  const audit = createAuditFixture();
  audit.meta_tags.robots = robots;
  return audit;
};

describe('metadata indexing directives', () => {
  it.each(['noarchive', 'nosnippet', 'index, follow, noarchive, nosnippet', 'NOARCHIVE; NOSNIPPET', 'xnoindex', 'noneother'])('does not block indexing for %s', (robots) => {
    const audit = withRobots(robots);
    expect(buildMetaAndIndexabilityChecks(audit).find((check) => check.id === 'robots-indexable')?.status).toBe('pass');
    expect(getMetadataProblems(audit).some((problem) => problem.id === 'metadata-indexing-blocked')).toBe(false);
  });
  it.each(['noindex', 'none', 'follow, NOINDEX', 'index;none', ' noindex '])('retains an explicit indexing block for %s', (robots) => {
    const audit = withRobots(robots);
    expect(buildMetaAndIndexabilityChecks(audit).find((check) => check.id === 'robots-indexable')?.status).toBe('error');
    expect(getMetadataProblems(audit).find((problem) => problem.id === 'metadata-indexing-blocked')?.severity).toBe('error');
  });
  it('retains the native blocked verdict even without a meta robots block', () => {
    const audit = withRobots('index, follow');
    audit.indexability = { status: 'blocked', reasons: ['HTTP status excludes indexing'] };
    expect(getMetadataProblems(audit).find((problem) => problem.id === 'metadata-indexing-blocked')?.detail).toBe('HTTP status excludes indexing');
  });
});
