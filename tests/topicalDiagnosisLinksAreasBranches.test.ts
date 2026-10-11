import { describe, expect, it } from 'vitest';
import { indexDocumentLinks } from '@/services/topicalDiagnosis/links';
import { areaLabel, buildAreas, NO_HUB_AREA_ID } from '@/services/topicalDiagnosis/areas';
import type { DiagnosisDocument } from '@/services/topicalDiagnosis/types';

describe('topicalDiagnosis links and areas branches', () => {
  it('covers link indexing with source:all, external links, self references and alias collisions', () => {
    const docs: DiagnosisDocument[] = [
      {
        id: 'doc-1',
        role: 'hub',
        section: 'blog',
        urls: ['https://site.test/hub', 'https://site.test/shared'],
        primaryPage: { url: 'https://site.test/hub', title: 'Hub 1' } as any,
        pages: [
          {
            url: 'https://site.test/hub',
            semantic_links: [{ is_internal: true, target_url: 'https://site.test/p1' } as any],
            links: [{ is_internal: true, target_url: 'https://site.test/p2' } as any],
          } as any,
        ],
      } as any,
      {
        id: 'doc-2',
        role: 'content',
        section: 'blog',
        urls: ['https://site.test/p1', 'https://site.test/shared'], // /shared is claimed by both doc-1 and doc-2!
        primaryPage: { url: 'https://site.test/p1', title: '' } as any,
        pages: [
          {
            url: 'https://site.test/p1',
            semantic_links: [
              { is_internal: false, target_url: 'https://external.test/' } as any,
              { is_internal: true, target_url: 'https://site.test/p1' } as any, // self reference
              { is_internal: true, target_url: 'https://site.test/shared' } as any, // unowned target
            ],
          } as any,
        ],
      } as any,
    ];

    const idxAll = indexDocumentLinks(docs, 'all');
    expect(idxAll.linksTo('doc-1', 'doc-2')).toBe(true);
    expect(idxAll.linksTo('doc-2', 'doc-1')).toBe(false);
    expect(idxAll.linksTo('unknown', 'doc-1')).toBe(false);

    const idxContent = indexDocumentLinks(docs, 'content');
    expect(idxContent.outgoing.get('doc-1')?.size).toBe(1);
  });

  it('covers areaLabel fallbacks and areas without hubs', () => {
    const hubWithUrlOnly: DiagnosisDocument = {
      id: 'doc-1',
      role: 'hub',
      section: 'blog',
      urls: ['https://site.test/category/'],
      primaryPage: { url: 'https://site.test/category/', title: '' } as any,
      pages: [],
    } as any;
    expect(areaLabel(hubWithUrlOnly)).toBe('/category/');

    const hubWithInvalidUrl: DiagnosisDocument = {
      id: 'doc-3',
      role: 'hub',
      section: 'blog',
      urls: ['not-a-valid-url'],
      primaryPage: { url: 'not-a-valid-url', title: '' } as any,
      pages: [],
    } as any;
    expect(areaLabel(hubWithInvalidUrl)).toBe('not-a-valid-url');

    const contentDocWithoutHub: DiagnosisDocument = {
      id: 'doc-2',
      role: 'content',
      section: 'other',
      urls: ['https://site.test/isolated'],
      primaryPage: { url: 'https://site.test/isolated', title: 'Isolated' } as any,
      pages: [],
    } as any;

    const links = indexDocumentLinks([hubWithUrlOnly, contentDocWithoutHub]);
    const { areas, areaByDocument } = buildAreas([hubWithUrlOnly, contentDocWithoutHub], links);

    expect(areaByDocument.get('doc-2')).toBe(NO_HUB_AREA_ID);
    const noHubArea = areas.find((a) => a.id === NO_HUB_AREA_ID);
    expect(noHubArea?.documentIds).toContain('doc-2');
  });
});
