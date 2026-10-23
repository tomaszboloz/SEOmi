import { describe, expect, it } from 'vitest';
import * as routes from '@/components/Layout/mainContent/mainContentRoutes';

const LAZY = Symbol.for('react.lazy');

describe('mainContentRoutes', () => {
  const entries = Object.entries(routes);

  it('exposes the expected route components', () => {
    const names = entries.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining([
      'AuditTabs', 'Overview', 'LinksAudit', 'KeywordResearch', 'RankTracking', 'DomainOverview', 'SiteAudit', 'McpHub', 'SeoToolsWorkspace',
    ]));
    expect(new Set(names).size).toBe(names.length);
  });

  it('exports only React.lazy components, so no route is bundled eagerly', () => {
    expect(entries.length).toBeGreaterThan(20);
    entries.forEach(([name, value]) => {
      expect((value as { $$typeof?: symbol }).$$typeof, name).toBe(LAZY);
    });
  });
});
