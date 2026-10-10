import { describe, expect, it } from 'vitest';
import { buildHeadingsChecks, buildTwitterCardChecks } from '@/services/auditChecks/socialAndHeadingsChecks';
import { audit } from './fixtures/auditChecksContracts';

const status = (items: { id: string; status: string }[], id: string) =>
  items.find((item) => item.id === id)?.status;

describe('social and heading fallback branches', () => {
  it('counts nameless and named Twitter tags without losing duplicate evidence', () => {
    const checks = buildTwitterCardChecks(audit({
      twitter_card: {
        twitter_card: 'summary', twitter_title: 'Title', all_tags: [
          { content: '' }, { name: 'twitter:card', content: '' }, { property: 'twitter:card', content: '' },
        ],
      },
    }));
    expect(status(checks, 'twitter-tags-duplicates')).toBe('warning');
  });

  it('handles a legacy missing hierarchy and reports recorded heading issues', () => {
    let hierarchyReads = 0;
    const nonFiniteHierarchy = { length: Number.NaN, every: () => true };
    const headings = {
      h1_count: 0, h1_texts: [], has_valid_hierarchy: false, issues: ['jump'],
      get hierarchy() {
        hierarchyReads += 1;
        return hierarchyReads === 1 ? undefined : nonFiniteHierarchy;
      },
    };
    const checks = buildHeadingsChecks(audit({ headings: headings as never }));
    expect(status(checks, 'heading-first-level')).toBe('not_applicable');
    expect(status(checks, 'heading-issues')).toBe('warning');
  });
});
