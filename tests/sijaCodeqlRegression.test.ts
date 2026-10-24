import { describe, expect, it } from 'vitest';
import { parseFeatures } from '@/services/sija/features';

describe('SIJA schema URL matching', () => {
  it('accepts an exact Schema.org host and type path', () => {
    expect(parseFeatures('<div itemtype="https://schema.org/LocalBusiness"></div>').localSignals).toBe(1);
    expect(parseFeatures('<div itemtype="http://schema.org/LocalBusiness"></div>').localSignals).toBe(1);
    expect(parseFeatures('<div itemtype="https://www.schema.org/PostalAddress"></div>').localSignals).toBe(1);
    expect(parseFeatures('<div itemtype="https://example.test/Thing https://schema.org/LocalBusiness"></div>').localSignals).toBe(1);
  });

  it('rejects deceptive hosts, malformed URLs and unsafe URL components', () => {
    expect(parseFeatures('<div itemtype="https://schema.org.evil.test/LocalBusiness"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="https://evil.test/?next=https://schema.org/LocalBusiness"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="https://schema.org/LocalBusiness/evil"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="ftp://schema.org/LocalBusiness"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="not a URL"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="https://user:pass@schema.org/LocalBusiness"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="https://schema.org:443/LocalBusiness"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="https://schema.org/LocalBusiness?source=test"></div>').localSignals).toBe(0);
    expect(parseFeatures('<div itemtype="https://schema.org/LocalBusiness#section"></div>').localSignals).toBe(0);
  });

  it('accepts structured JSON-LD types and ignores prose mentions', () => {
    expect(parseFeatures(`<script type="application/ld+json">${JSON.stringify({ '@type': 'https://schema.org/LocalBusiness' })}</script>`).localSignals).toBe(1);
    expect(parseFeatures(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org/', '@type': 'LocalBusiness' })}</script>`).localSignals).toBe(1);
    expect(parseFeatures(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://evil.test/?next=https://schema.org', '@type': 'LocalBusiness' })}</script>`).localSignals).toBe(0);
    expect(parseFeatures('<div data-note="https://schema.org/LocalBusiness"></div>').localSignals).toBe(0);
  });
});
