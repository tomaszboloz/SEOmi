import { describe, expect, it } from 'vitest';
import { parseFeatures } from '@/services/sija/features';

describe('geminiGapBACKLOG: sija features schema and context branches', () => {
  it('covers microdata itemtype branches and authority parsing with real HTML', () => {
    // Matching schema.org LocalBusiness in standard microdata
    const matching = parseFeatures('<div itemtype="https://schema.org/LocalBusiness">Store</div>');
    expect(matching.localSignals).toBe(1);

    // Multi-type microdata with extra spaces
    const multi = parseFeatures('<div itemtype="https://schema.org/Store   https://schema.org/LocalBusiness">Shop</div>');
    expect(multi.localSignals).toBe(1);

    // Empty and non-matching itemtype attributes
    const nonMatching = parseFeatures('<div itemtype="https://schema.org/Article">News</div><div itemtype="">Empty</div>');
    expect(nonMatching.localSignals).toBe(0);

    // Whitespace-only itemtype attribute
    const whitespace = parseFeatures('<div itemtype="   ">Whitespace</div>');
    expect(whitespace.localSignals).toBe(0);

    // Schema URL without // (authorityStart < 0) or non-schema scheme
    const noSlash = parseFeatures('<div itemtype="mailto:info@schema.org">Mail</div><div itemtype="urn:isbn:12345">Book</div>');
    expect(noSlash.localSignals).toBe(0);

    // Microdata inside ignored content element (navigation) is skipped
    const inNav = parseFeatures('<nav><div itemtype="https://schema.org/LocalBusiness">Nav Store</div></nav>');
    expect(inNav.localSignals).toBe(0);
  });

  it('covers context arrays, objects, query params and hashes on lines 29, 30, 33', () => {
    // Array @context (line 29)
    const arrayCtx = JSON.stringify({
      '@context': ['https://schema.org', { '@language': 'en' }],
      '@type': 'LocalBusiness',
    });
    expect(parseFeatures(`<script type="application/ld+json">${arrayCtx}</script>`).localSignals).toBe(1);

    // Object @context with @vocab (line 30)
    const objectCtx = JSON.stringify({
      '@context': { '@vocab': 'https://schema.org/' },
      '@type': 'LocalBusiness',
    });
    expect(parseFeatures(`<script type="application/ld+json">${objectCtx}</script>`).localSignals).toBe(1);

    // Context with search query parameter (line 33 rejected)
    const searchCtx = JSON.stringify({ '@context': 'https://schema.org/?q=param', '@type': 'LocalBusiness' });
    expect(parseFeatures(`<script type="application/ld+json">${searchCtx}</script>`).localSignals).toBe(0);

    // Context with fragment hash (line 33 rejected)
    const hashCtx = JSON.stringify({ '@context': 'https://schema.org/#section', '@type': 'LocalBusiness' });
    expect(parseFeatures(`<script type="application/ld+json">${hashCtx}</script>`).localSignals).toBe(0);

    // Context with non-root subpath (line 33 rejected)
    const pathCtx = JSON.stringify({ '@context': 'https://schema.org/SubPath', '@type': 'LocalBusiness' });
    expect(parseFeatures(`<script type="application/ld+json">${pathCtx}</script>`).localSignals).toBe(0);
  });

  it('covers JSON-LD arrays, string vs array @type, and parser fallbacks without DOM forgery', () => {
    // JSON-LD root array of entities and @type array (lines 40, 44)
    const rootArray = JSON.stringify([
      { '@context': 'https://schema.org', '@type': ['LocalBusiness', 'Store'] },
    ]);
    expect(parseFeatures(`<script type="application/ld+json">${rootArray}</script>`).localSignals).toBe(1);

    // PostalAddress schema type with string @type
    const postal = JSON.stringify({ '@context': 'https://schema.org', '@type': 'PostalAddress' });
    expect(parseFeatures(`<script type="application/ld+json">${postal}</script>`).localSignals).toBe(1);

    // Empty script tag: real textContent is "", JSON.parse fails in catch block (line 49)
    const emptyScript = parseFeatures('<script type="application/ld+json"></script>');
    expect(emptyScript.localSignals).toBe(0);

    // Whitespace only script tag: real textContent is "  ", JSON.parse fails in catch block
    const wsScript = parseFeatures('<script type="application/ld+json">   \n   </script>');
    expect(wsScript.localSignals).toBe(0);

    // Malformed JSON inside script (line 49 catch block)
    const malformed = parseFeatures('<script type="application/ld+json">{ broken json </script>');
    expect(malformed.localSignals).toBe(0);

    // Non-object JSON value (primitive null, number)
    expect(parseFeatures('<script type="application/ld+json">null</script>').localSignals).toBe(0);
    expect(parseFeatures('<script type="application/ld+json">42</script>').localSignals).toBe(0);

    // Script inside ignored content element (header) is ignored
    const inHeader = parseFeatures(`<header><script type="application/ld+json">${postal}</script></header>`);
    expect(inHeader.localSignals).toBe(0);
  });
});
