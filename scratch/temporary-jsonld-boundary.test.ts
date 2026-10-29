import { describe, expect, it } from 'vitest';
import { buildTrustJsonLd } from '@/services/eeatTrust';

const input = { personName: '</script><script>alert(1)</script>', jobTitle: 'x', organizationUrl: 'https://site.test', pageUrl: 'https://site.test/p', sameAs: [] };

describe('temporary production boundary evidence', () => {
  it('old raw graph serialization is vulnerable (RED proof)', () => {
    const result = buildTrustJsonLd(input);
    expect(JSON.stringify(result.graph)).not.toContain('</script>');
  });
  it('production text serialization is safe (GREEN proof)', () => {
    const result = buildTrustJsonLd(input);
    expect(result.text).not.toContain('</script>');
    expect(result.text).toContain('<\\/script>');
  });
});
