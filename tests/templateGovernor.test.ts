import { describe, expect, it } from 'vitest';
import {
  clusterTemplates,
  deduplicateTasPages,
  governTemplates,
  patternOf,
  templateInformationGain,
  uniqueInjectedVariableShare,
  variableOf,
} from '@/services/templateGovernor';

const boiler = 'Dieta cukrzycowa dla mieszkańców miasta wybierz plan żywienia sprawdź jadłospis zamów konsultację dietetyka online teraz';
const city = (n: number, extra = '') => ({ url: `https://x.pl/dieta-cukrzycowa-miasto${n}`, text: `${boiler} miasto${n} ${extra}`, injectedVariables: [`miasto${n}`] });

describe('template clustering', () => {
  it('derives patterns', () => {
    expect(patternOf('https://x.pl/dieta-cukrzycowa-krakow')).toBe('/dieta-cukrzycowa-{var}');
    expect(patternOf('https://x.pl/blog/krakow.html')).toBe('/blog/{var}');
    expect(patternOf('https://x.pl/')).toBe('/');
    expect(patternOf('::bad')).toBe('/');
    expect(variableOf('https://x.pl/')).toBe('');
  });
  it('splits clusters by DOM signature', () => {
    const pages = [{ ...city(1), domSignature: 'a' }, { ...city(2), domSignature: 'b' }, { ...city(3), domSignature: 'a' }];
    expect(clusterTemplates(pages).map((c) => c.pages.length)).toEqual([2, 1]);
  });
  it('preserves all URLs in cluster and projects one TAS page per sub-topic', () => {
    const pages = [{ ...city(1), subtopicId: 'local' }, { ...city(1), subtopicId: 'duplicate' }, { ...city(2), subtopicId: 'local' }, { ...city(3), subtopicId: 'other' }];
    const cluster = clusterTemplates(pages)[0];
    expect(cluster.pages.map((page) => page.url)).toEqual([
      'https://x.pl/dieta-cukrzycowa-miasto1',
      'https://x.pl/dieta-cukrzycowa-miasto2',
      'https://x.pl/dieta-cukrzycowa-miasto3',
    ]);
    expect(deduplicateTasPages(cluster.pages).map((page) => page.url)).toEqual([
      'https://x.pl/dieta-cukrzycowa-miasto1',
      'https://x.pl/dieta-cukrzycowa-miasto3',
    ]);
    expect(clusterTemplates([{ url: '::bad', text: '' }, { url: 'example.test/a', text: '' }])).toHaveLength(2);
  });
});

describe('template governor', () => {
  it('turns 500 near-identical local pages into one event with TAS projection', () => {
    const pages = Array.from({ length: 500 }, (_, n) => ({ ...city(n), subtopicId: `topic-${n % 10}` }));
    const events = governTemplates(clusterTemplates(pages));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      pattern: '/dieta-cukrzycowa-{var}',
      pageCount: 500,
      verdict: 'template-bloat',
      action: 'noindex',
      tasSubtopicCount: 10,
      recommendation: { action: 'noindex', readOnly: true, requiresApproval: true },
    });
    expect(events[0].urls).toHaveLength(500);
    expect(events[0].tasRepresentativeUrls).toHaveLength(10);
  });
  it('respects the uniqueness threshold', () => {
    const unique = (n: number) => ({
      url: `https://x.pl/dieta-cukrzycowa-m${n}`,
      text: Array.from({ length: 40 }, (_, k) => `slowo${n}x${k}`).join(' '),
      injectedVariables: [`var${n}`],
    });
    const rich = Array.from({ length: 12 }, (_, n) => unique(n));
    expect(templateInformationGain(clusterTemplates(rich)[0])).toBeGreaterThan(0.9);
    expect(governTemplates(clusterTemplates(rich))).toEqual([]);
    const mid = Array.from({ length: 12 }, (_, n) => city(n, Array.from({ length: 5 }, (_, k) => `u${n}x${k}`).join(' ')));
    const [event] = governTemplates(clusterTemplates(mid));
    expect(event.action).toBe('limit');
    expect(event.verdict).toBe('thin-template');
    expect(event.recommendation).toMatchObject({ action: 'limit', scope: 'template-segment', readOnly: true, requiresApproval: true });
    expect(uniqueInjectedVariableShare(clusterTemplates(mid)[0])).toBe(1);
  });
  it('uses the injected-variable threshold when URL values repeat', () => {
    const pages = Array.from({ length: 10 }, (_, n) => ({ url: `https://x.pl/guide-${n}`, text: `same body ${n}`, injectedVariables: ['same-segment'] }));
    const [event] = governTemplates(clusterTemplates(pages), { uniqueVariableBelow: 0.5 });
    expect(event.uniqueVariableShare).toBe(0);
    expect(event.action).toBe('limit');
  });
  it('ignores small clusters and empty text', () => {
    expect(governTemplates(clusterTemplates([city(1), city(2)]))).toEqual([]);
    expect(templateInformationGain({ pattern: '/', pages: [{ url: 'x', text: '' }] })).toBe(0);
    expect(uniqueInjectedVariableShare({ pattern: '/', pages: [{ url: 'https://x.pl/', text: '' }] })).toBeNull();
    expect(uniqueInjectedVariableShare({ pattern: '/', pages: [{ url: 'https://x.pl/', text: '', injectedVariables: [] }] })).toBe(0);
  });
});
