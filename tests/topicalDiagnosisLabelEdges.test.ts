import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { topicLabel } from '@/services/topicalDiagnosis/labels';
import { buildTermStatistics } from '@/services/topicalDiagnosis/similarity';

const documents = (count = 2) => buildDiagnosisDocuments(
  Array.from({ length: count }, (_, index) => createCrawlPageFixture({
    url: `https://example.test/${index}`, final_url: `https://example.test/${index}`,
    title: '', semantic_language: 'pl', semantic_terms: [],
  })), 'https://example.test/',
).documents;

describe('topic labels with bounded or missing evidence', () => {
  it('has no invented label for an empty member set', () => {
    expect(topicLabel([], [], buildTermStatistics([], new Set())))
      .toEqual({ label: '', source: 'none' });
  });

  it('can label a single member without requiring two title observations', () => {
    const docs = documents(1);
    docs[0].titleTerms = new Set(['pl:astronomia']);
    docs[0].titleForms = new Map([['pl:astronomia', 'astronomia']]);
    expect(topicLabel(docs, docs, buildTermStatistics(docs, new Set())))
      .toEqual({ label: 'astronomia', source: 'title' });
  });

  it('keeps a primary-language word before the shared foreign word', () => {
    const docs = documents();
    docs.forEach(doc => {
      doc.titleTerms = new Set(['en:galaxy', 'pl:orbita']);
      doc.titleForms = new Map([['pl:orbita', 'orbita'], ['en:galaxy', 'galaxy']]);
    });
    expect(topicLabel(docs, docs, buildTermStatistics(docs, new Set())))
      .toEqual({ label: 'orbita galaxy', source: 'title' });
  });

  it('uses the observed term identity when a title surface form is absent', () => {
    const docs = documents();
    docs.forEach(doc => { doc.titleTerms = new Set(['pl:orbita']); });
    expect(topicLabel(docs, docs, buildTermStatistics(docs, new Set())))
      .toEqual({ label: 'pl:orbita', source: 'title' });
  });

  it('retains content identity without inventing a missing surface form', () => {
    const docs = documents();
    docs.forEach(doc => { doc.terms = new Set(['pl:orbita']); });
    expect(topicLabel(docs, docs, buildTermStatistics(docs, new Set())))
      .toEqual({ label: 'orbita', source: 'content' });
  });

  it('deduplicates display forms that differ only in diacritics', () => {
    const docs = documents();
    docs.forEach(doc => {
      doc.titleTerms = new Set(['pl:lodz', 'en:lodz']);
      doc.titleForms = new Map([['pl:lodz', 'łódź'], ['en:lodz', 'lodz']]);
    });
    expect(topicLabel(docs, docs, buildTermStatistics(docs, new Set())))
      .toEqual({ label: 'łódź', source: 'title' });
  });
});
