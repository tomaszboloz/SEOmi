import { describe, expect, it } from 'vitest';
import { buildTaxonomy } from '@/services/topicalAuthority/taxonomy';

const page = (url: string, h2: string[]) => ({ url, heading_texts: { h1: [], h2, h3: [] }, focus_terms: [] }) as never;
const input = (paa: string[], suggestions: string[]) => ({
  coreLabel: 'coffee', coreKeys: new Set(['coffee']), language: 'en', suggestions, paa, source: 'test', now: '2026-01-01T00:00:00Z',
  competitors: [
    { domain: 'a.com', pages: [page('https://a.com/1', ['Espresso machines', 'Grinder burrs'])] },
    { domain: 'b.com', pages: [page('https://b.com/1', ['Intro words here', 'Best espresso machines'])] },
  ],
});

describe('taxonomy aliases, confidence and rank (#57)', () => {
  it('records aliases, rank and evidence confidence', () => {
    const tax = buildTaxonomy(input(['espresso machines?'], ['espresso machines']))!;
    const node = tax.subtopics.find((item) => item.label.toLowerCase().includes('espresso'))!;
    expect(node.confidence).toBe(1);
    expect(node.rank).toBe(1);
    expect(node.aliases!.length).toBeGreaterThan(0);
    expect(node.aliases).not.toContain(node.label);
  });
  it('confidence 2/3 without PAA and rank stays 1..20', () => {
    const tax = buildTaxonomy(input([], ['espresso machines']))!;
    const node = tax.subtopics.find((item) => item.label.toLowerCase().includes('espresso'))!;
    expect(node.confidence).toBeCloseTo(0.667, 3);
    expect(node.rank).toBeLessThanOrEqual(20);
  });
});
