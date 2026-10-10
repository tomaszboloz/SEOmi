import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  highlightQuery,
  readSerpDraft,
  serpDraftKey,
} from '@/components/Results/social/socialHelpers';
import type { SerpDraft } from '@/components/Results/social/socialTypes';

const fallback: SerpDraft = {
  title: 'Fallback title',
  description: 'Fallback description',
  image: '',
  query: '',
};

afterEach(() => localStorage.clear());

describe('social preview helper contracts', () => {
  it('builds an encoded project key and returns null without a project', () => {
    expect(serpDraftKey(null, 'https://example.test/a b?x=1')).toBeNull();
    expect(serpDraftKey('project/1', 'https://example.test/a b?x=1')).toBe(
      'seomi_serp_preview_project/1_https%3A%2F%2Fexample.test%2Fa%20b%3Fx%3D1',
    );
  });

  it('reads only valid draft fields and preserves fallback values', () => {
    localStorage.setItem('draft', JSON.stringify({ title: 'Saved', image: 4, query: 'seo' }));
    expect(readSerpDraft('draft', fallback)).toEqual({
      title: 'Saved', description: fallback.description, image: fallback.image, query: 'seo',
    });
    localStorage.setItem('draft', '{invalid');
    expect(readSerpDraft('draft', fallback)).toEqual(fallback);
    expect(readSerpDraft(null, fallback)).toBe(fallback);
  });

  it('falls back when readJsonRecord returns falsy or throws', async () => {
    const contracts = await import('@/services/storageContracts');
    const spy = vi.spyOn(contracts, 'readJsonRecord').mockReturnValueOnce(null as any);
    expect(readSerpDraft('draft', fallback)).toEqual(fallback);
    spy.mockRestore();

    const spyThrow = vi.spyOn(contracts, 'readJsonRecord').mockImplementationOnce(() => {
      throw new Error('fail');
    });
    expect(readSerpDraft('draft', fallback)).toEqual(fallback);
    spyThrow.mockRestore();
  });

  it('highlights case-insensitive query terms and escapes regex characters', () => {
    const markup = renderToStaticMarkup(highlightQuery('SEO (audit) now', 'seo (audit)'));
    expect(markup).toContain('<strong');
    expect(markup).toContain('>SEO</strong>');
    expect(markup).toContain('>(audit)</strong>');
    expect(renderToStaticMarkup(highlightQuery('plain text', '   '))).toBe('plain text');
  });
});

