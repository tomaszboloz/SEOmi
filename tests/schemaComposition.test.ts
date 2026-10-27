import { describe, expect, it } from 'vitest';
import { buildTrustJsonLd } from '@/services/eeatTrust';
import { composeSchemaGraph, serializeJsonLd } from '@/services/schemaGenerator';

describe('schema graph composition', () => {
  it('keeps observed IDs and reports conflicting facts instead of overwriting them', () => {
    const trust = buildTrustJsonLd({ personName: 'A', organizationName: 'Incoming', organizationUrl: 'https://site.test', pageUrl: 'https://site.test/p', sameAs: [] });
    const result = composeSchemaGraph({ observed: { '@graph': [
      { '@id': 'https://site.test/#organization', '@type': 'Organization', name: 'Observed' },
      { '@id': 'https://site.test/p#breadcrumb', '@type': 'BreadcrumbList' },
    ] }, trust });
    expect(result.schema['@graph']).toHaveLength(4);
    expect(result.conflicts.some((item) => item.property === 'name')).toBe(true);
    expect((result.schema['@graph'] as Array<Record<string, unknown>>)[0].name).toBe('Observed');
  });

  it('escapes script terminators in the actual exported text', () => {
    const text = serializeJsonLd({ '@graph': [{ '@id': 'x', name: '</script><script>alert(1)</script>' }] });
    expect(text).not.toMatch(/<\/script/iu);
    expect(text).toContain('<\\/script>');
  });
});
