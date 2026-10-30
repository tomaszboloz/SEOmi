import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { buildTrustJsonLd, type TrustJsonLdInput } from '@/services/eeatTrust/jsonLd';
import { observedEntityIds } from '@/services/eeatTrust/jsonLdIds';
import { nodesOf } from '@/services/eeatTrust/graph';
import { composeSchemaGraph } from '@/services/schemaGenerator';
import { node } from './eeatTrustFixtures';

const base: TrustJsonLdInput = { personName: 'Anna Nowak', sameAs: [], organizationUrl: 'https://s.test/', pageUrl: 'https://s.test/guide' };
const ids = (graph: Record<string, unknown>) => (graph['@graph'] as Array<Record<string, unknown>>).map((item) => item['@id']);
const page = (url: string, refs: ReturnType<typeof node>) => ({ url, final_url: url, http_status: 200, schema_references: refs }) as unknown as CrawledPageSummary;

describe('JSON-LD generator keeps existing identities (#66)', () => {
  it('reuses observed @id values instead of generating parallel ones', () => {
    const result = buildTrustJsonLd({ ...base, ids: { person: 'https://s.test/team/anna#me', organization: 'https://s.test/#publisher', page: 'https://s.test/guide#page' } });
    expect(ids(result.graph)).toEqual(['https://s.test/#publisher', 'https://s.test/team/anna#me', 'https://s.test/guide#page']);
    const pageNode = (result.graph['@graph'] as Array<Record<string, unknown>>)[2];
    expect(pageNode.author).toEqual({ '@id': 'https://s.test/team/anna#me' });
    expect(pageNode.publisher).toEqual({ '@id': 'https://s.test/#publisher' });
  });

  it('falls back to generated ids for unusable observed values', () => {
    const result = buildTrustJsonLd({ ...base, ids: { person: 'javascript:alert(1)', organization: '  ', page: 'urn:x y' } });
    expect(ids(result.graph)).toEqual(['https://s.test/#organization', 'https://s.test/#anna-nowak', 'https://s.test/guide#webpage']);
  });

  it('merges into the observed publisher instead of adding a second Organization', () => {
    const observed = { '@graph': [{ '@id': 'https://s.test/#publisher', '@type': 'Organization', name: 'Site' }] };
    const result = buildTrustJsonLd({ ...base, organizationName: 'Site', ids: { organization: 'https://s.test/#publisher' } });
    const composed = composeSchemaGraph({ observed, trust: result });
    const organizations = (composed.schema['@graph'] as Array<Record<string, unknown>>).filter((item) => item['@type'] === 'Organization');
    expect(organizations).toHaveLength(1);
    expect(composed.conflicts).toEqual([]);
  });

  it('flags a MedicalWebPage without reviewer as advisory and never invents one', () => {
    const result = buildTrustJsonLd({ ...base, category: 'health' });
    expect(result.issues).toContain('medical-no-reviewer');
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.graph)).not.toContain('reviewedBy');
    expect(buildTrustJsonLd({ ...base, category: 'finance' }).issues).not.toContain('medical-no-reviewer');
    expect(buildTrustJsonLd({ ...base, category: 'health', asReviewer: true }).issues).not.toContain('medical-no-reviewer');
  });

  it('reads publisher and page ids from the crawl, preferring the page itself', () => {
    const nodes = [
      page('https://s.test/', node('$', { id: 'https://s.test/#home-org', type: 'Organization' })),
      page('https://s.test/guide', [...node('$.@graph[0]', { id: 'https://s.test/#org', type: 'Organization' }), ...node('$.@graph[1]', { id: 'https://s.test/guide#page', type: 'MedicalWebPage' })]),
    ].flatMap(nodesOf);
    expect(observedEntityIds(nodes, 'https://s.test/guide')).toEqual({ organization: 'https://s.test/#org', page: 'https://s.test/guide#page' });
    expect(observedEntityIds(nodes, 'https://s.test/other')).toEqual({ organization: 'https://s.test/#home-org' });
    expect(observedEntityIds([], 'https://s.test/')).toEqual({});
  });
});
