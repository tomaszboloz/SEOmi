import { describe, expect, it } from 'vitest';
import { clusterTemplates, governTemplates, patternOf, templateInformationGain } from '@/services/templateGovernor';

const boiler = 'Dieta cukrzycowa dla mieszkańców miasta wybierz plan żywienia sprawdź jadłospis zamów konsultację dietetyka online teraz';
const city = (n: number, extra = '') => ({ url: `https://x.pl/dieta-cukrzycowa-miasto${n}`, text: `${boiler} miasto${n} ${extra}` });

describe('template clustering', () => {
  it('derives patterns', () => {
    expect(patternOf('https://x.pl/dieta-cukrzycowa-krakow')).toBe('/dieta-cukrzycowa-{var}');
    expect(patternOf('https://x.pl/blog/krakow.html')).toBe('/blog/{var}');
    expect(patternOf('https://x.pl/')).toBe('/');
    expect(patternOf('::bad')).toBe('/');
  });
  it('splits clusters by DOM signature', () => {
    const pages = [{ ...city(1), domSignature: 'a' }, { ...city(2), domSignature: 'b' }, { ...city(3), domSignature: 'a' }];
    expect(clusterTemplates(pages).map((c) => c.pages.length)).toEqual([2, 1]);
  });
});

describe('template governor', () => {
  it('turns 500 near-identical local pages into one event', () => {
    const pages = Array.from({ length: 500 }, (_, n) => city(n));
    const events = governTemplates(clusterTemplates(pages));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ pattern: '/dieta-cukrzycowa-{var}', pageCount: 500, verdict: 'template-bloat', action: 'noindex' });
    expect(events[0].urls).toHaveLength(500);
  });
  it('respects the uniqueness threshold', () => {
    const unique = (n: number) => ({ url: `https://x.pl/dieta-cukrzycowa-m${n}`, text: Array.from({ length: 40 }, (_, k) => `slowo${n}x${k}`).join(' ') });
    const rich = Array.from({ length: 12 }, (_, n) => unique(n));
    expect(templateInformationGain(clusterTemplates(rich)[0])).toBeGreaterThan(0.9);
    expect(governTemplates(clusterTemplates(rich))).toEqual([]);
    const mid = Array.from({ length: 12 }, (_, n) => city(n, Array.from({ length: 5 }, (_, k) => `u${n}x${k}`).join(' ')));
    const [event] = governTemplates(clusterTemplates(mid));
    expect(event.action).toBe('limit');
    expect(event.verdict).toBe('thin-template');
  });
  it('ignores small clusters and empty text', () => {
    expect(governTemplates(clusterTemplates([city(1), city(2)]))).toEqual([]);
    expect(templateInformationGain({ pattern: '/', pages: [{ url: 'x', text: '' }] })).toBe(0);
  });
});
