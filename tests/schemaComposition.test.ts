import { describe, expect, it } from 'vitest';
import { buildTrustJsonLd, safeJsonLdText } from '@/services/eeatTrust';
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
    expect(text).toContain('\\u003c/script>');
  });

  it('keeps the page intact when data opens a comment before a script tag', () => {
    const value = { '@graph': [{ '@id': 'x', name: 'Jan <!--<script> Kowalski\u2028' }] };
    const { script, text } = composeSchemaGraph({ observed: value });
    expect(text).not.toContain('<');
    const doc = new DOMParser().parseFromString(`<body>${script}<p id="after">after</p></body>`, 'text/html');
    expect(doc.getElementById('after')?.textContent).toBe('after');
    const parsed = JSON.parse(doc.querySelector('script')?.textContent ?? '') as { '@graph': Array<{ name: string }> };
    expect(parsed['@graph'][0].name).toBe(value['@graph'][0].name);
  });

  it('uses one serializer for trust and composed exports', () => {
    const value = { name: '<b>&</b>' };
    expect(safeJsonLdText(value)).toBe(serializeJsonLd(value));
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
    expect(buildTrustJsonLd({ personName: '<!--<script>', organizationUrl: 'https://site.test', pageUrl: 'https://site.test/p', sameAs: [] }).text).not.toContain('<');
  });
});
