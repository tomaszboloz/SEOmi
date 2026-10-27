import { describe, expect, it } from 'vitest';
import { checkAlt } from '@/services/multimodal/altCheck';
import type { AltInput, AltVerdict } from '@/services/multimodal/altCheck';

describe('altCheck - absent, empty and decorative roles', () => {
  it('returns unknown role with missing issue when alt is undefined, ignoring caption and context', () => {
    const input: AltInput = {
      src: '/images/hero.webp',
      alt: undefined,
      caption: 'Hero header banner',
      context: 'Article discussing website performance and image optimization',
    };
    const expected: AltVerdict = {
      role: 'unknown',
      issues: ['missing'],
      contextOverlap: null,
    };
    expect(checkAlt(input)).toEqual(expected);
  });

  it('marks explicit empty string as decorative with no issues', () => {
    const res = checkAlt({ src: '/ui/divider.svg', alt: '' });
    expect(res).toEqual({ role: 'decorative', issues: [], contextOverlap: null });
  });

  it('treats whitespace-only alt as decorative with no issues', () => {
    const res = checkAlt({
      src: '/ui/spacer.png',
      alt: '\t\n   \r\n',
      caption: 'Spacer line',
      context: 'Contextual paragraph describing content layout',
    });
    expect(res).toEqual({ role: 'decorative', issues: [], contextOverlap: null });
  });
});

describe('altCheck - descriptive text and lexical context overlap', () => {
  it('computes partial overlap ratio when some tokens match', () => {
    const res = checkAlt({
      src: '/catalog/chair.avif',
      alt: 'drewniane krzesło biurowe',
      context: 'Nowoczesne biurowe meble ergonomiczne dla pracowników',
    });
    expect(res.role).toBe('unknown');
    expect(res.issues).toEqual([]);
    expect(res.contextOverlap).toBeCloseTo(1 / 3, 5);
  });

  it('returns null overlap without issue when context has no 3-character tokens', () => {
    const res = checkAlt({
      src: '/icons/gear.png',
      alt: 'Ustawienia profilu',
      context: 'w o z do na',
    });
    expect(res.contextOverlap).toBeNull();
    expect(res.issues).toEqual([]);
  });

  it('returns null overlap without issue when alt has no 3-character tokens', () => {
    const res = checkAlt({
      src: '/icons/gear.png',
      alt: 'to',
      context: 'Kompletny przewodnik po ustawieniach konta',
    });
    expect(res.contextOverlap).toBeNull();
    expect(res.issues).toEqual([]);
  });

  it('flags unrelated-to-context when both sides have tokens but none overlap', () => {
    const res = checkAlt({
      src: '/products/mixer.jpg',
      alt: 'Mikser kuchenny planetarny',
      context: 'Opony zimowe i felgi aluminiowe do samochodów',
    });
    expect(res.contextOverlap).toBe(0);
    expect(res.issues).toContain('unrelated-to-context');
  });
});

describe('altCheck - length boundaries and caption repeats', () => {
  it('accepts trimmed alt text of exactly 125 characters without too-long issue', () => {
    const text125 = 'x'.repeat(125);
    const res = checkAlt({ src: '/img.png', alt: `  ${text125}  ` });
    expect(res.issues).not.toContain('too-long');
  });

  it('flags too-long issue when trimmed alt text exceeds 125 characters', () => {
    const text126 = 'y'.repeat(126);
    const res = checkAlt({ src: '/img.png', alt: text126 });
    expect(res.issues).toContain('too-long');
  });

  it('flags repeats-caption on case-insensitive match with outer whitespace', () => {
    const res = checkAlt({
      src: '/nature/forest.jpg',
      alt: 'Las sosnowy o poranku',
      caption: '  LAS SOSNOWY O PORANKU  ',
    });
    expect(res.issues).toContain('repeats-caption');
  });

  it('does not flag repeats-caption when caption differs or is whitespace', () => {
    const resDiff = checkAlt({
      src: '/nature/forest.jpg',
      alt: 'Las sosnowy o poranku',
      caption: 'Widok na las iglasty',
    });
    expect(resDiff.issues).not.toContain('repeats-caption');

    const resWhitespace = checkAlt({
      src: '/nature/forest.jpg',
      alt: 'Las sosnowy o poranku',
      caption: '   ',
    });
    expect(resWhitespace.issues).not.toContain('repeats-caption');
  });
});
