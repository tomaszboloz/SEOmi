import { describe, expect, it } from 'vitest';
import { cleanText, id, oneOf, validHttpUrl } from '@/services/topicalDocument/primitives';
import { normalizeFact } from '@/services/topicalDocument/fact';
import { createEmptyContentBrief, createEmptyTopicalMap, createTopicalNode } from '@/services/topicalDocument/factories';
import { formatLocalDate, shiftTopicalCalendarMonth, topicalCalendarDays } from '@/services/topicalDocument/calendar';

describe('topical primitive contracts', () => {
  it('trims bounded text and accepts only allowed enum values', () => {
    expect(cleanText(' abc ', 2)).toBe('ab');
    expect(cleanText(1, 2)).toBe('');
    expect(oneOf('a', ['a', 'b'], 'b')).toBe('a');
    expect(oneOf(null, ['a', 'b'], 'b')).toBe('b');
    expect(id()).toEqual(expect.any(String));
    expect(id()).not.toBe(id());
  });
  it('normalizes HTTP URLs and rejects missing, malformed and unsafe URLs', () => {
    expect(validHttpUrl('https://SITE.test')).toBe('https://site.test/');
    expect(validHttpUrl('http://site.test')).toBe('http://site.test/');
    for (const value of [null, 'not a URL', 'javascript:alert(1)']) expect(validHttpUrl(value)).toBeNull();
  });
  it('requires fact content and explicit source verification', () => {
    for (const value of [null, 1, {}, { attribute: 'a' }, { value: 'b' }]) expect(normalizeFact(value)).toBeNull();
    expect(normalizeFact({ attribute: 'a', value: 'b' })).toMatchObject({ attribute: 'a', value: 'b', sourceUrl: '', reuseStatus: 'locked' });
    expect(normalizeFact({ id: 'f', attribute: 'a', value: 'b', sourceUrl: 'https://site.test', reuseStatus: 'verified' }))
      .toEqual({ id: 'f', attribute: 'a', value: 'b', sourceUrl: 'https://site.test/', reuseStatus: 'verified' });
    expect(normalizeFact({ attribute: 'a', value: 'b', sourceUrl: 'https://site.test' })?.reuseStatus).toBe('locked');
  });
  it('creates empty independent drafts and translated fallback node titles', () => {
    expect(createEmptyTopicalMap()).toMatchObject({ schemaVersion: 1, nodes: [], entity: { facts: [] } });
    expect(createEmptyContentBrief()).toEqual({ targetQueryId: '', requiredEntities: [], snippetTarget: 'none', internalLinkTargets: [], draftMarkdown: '', paragraphReviews: [], draftVersions: [] });
    expect(createTopicalNode(' Topic ').title).toBe('Topic');
    expect(createTopicalNode('').title).toBe(createTopicalNode().title);
  });
  it('formats local dates and falls back to the current month', () => {
    expect(formatLocalDate(new Date(2028, 1, 9))).toBe('2028-02-09');
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(shiftTopicalCalendarMonth('invalid', 0)).toBe(month);
    expect(topicalCalendarDays('invalid')).toEqual(topicalCalendarDays(month));
    expect(shiftTopicalCalendarMonth('2026-12', 1.9)).toBe('2027-01');
  });
});
