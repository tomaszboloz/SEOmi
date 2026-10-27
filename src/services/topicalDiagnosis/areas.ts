import type { DiagnosisArea, DiagnosisDocument } from './types';
import type { DocumentLinkIndex } from './links';
import { TITLE_SEPARATOR } from './documents';

export const NO_HUB_AREA_ID = 'area-none';

const pathDepth = (url: string): number => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
};

const documentIndex = (id: string): number => Number(id.slice(4));

export const areaLabel = (hub: DiagnosisDocument): string => {
  const title = (hub.primaryPage.title ?? '').replace(TITLE_SEPARATOR, '').trim();
  if (title) return title;
  try {
    return new URL(hub.primaryPage.url).pathname || '/';
  } catch {
    return hub.primaryPage.url;
  }
};

/**
 * An area is a hub with the content documents of its own section that it links
 * to from its main content (a category's call-to-action link to an offer page
 * does not make the offer part of the category). A document linked from
 * several hubs belongs to the most specific one: fewest members, then the
 * deeper path, then the earlier document.
 */
export const buildAreas = (
  documents: DiagnosisDocument[], links: DocumentLinkIndex,
): { areas: DiagnosisArea[]; areaByDocument: Map<string, string> } => {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const hubs = documents.filter((document) => document.role === 'hub');
  const membersByHub = new Map(hubs.map((hub) => [hub.id, [...(links.outgoing.get(hub.id) ?? [])]
    .filter((target) => byId.get(target)?.role === 'content' && byId.get(target)?.section === hub.section)]));
  const areaByDocument = new Map<string, string>();
  documents.filter((document) => document.role === 'content').forEach((document) => {
    const candidates = hubs.filter((hub) => membersByHub.get(hub.id)!.includes(document.id))
      .sort((a, b) => membersByHub.get(a.id)!.length - membersByHub.get(b.id)!.length
        || pathDepth(b.primaryPage.url) - pathDepth(a.primaryPage.url)
        || documentIndex(a.id) - documentIndex(b.id));
    areaByDocument.set(document.id, candidates.length ? `area-${candidates[0].id}` : NO_HUB_AREA_ID);
  });
  const sortedIds = (ids: string[]) => [...ids].sort((a, b) => documentIndex(a) - documentIndex(b));
  const areas: DiagnosisArea[] = hubs.map((hub) => ({
    id: `area-${hub.id}`,
    hubId: hub.id,
    label: areaLabel(hub),
    documentIds: sortedIds([...areaByDocument].filter(([, area]) => area === `area-${hub.id}`).map(([id]) => id)),
  }));
  const withoutHub = sortedIds([...areaByDocument].filter(([, area]) => area === NO_HUB_AREA_ID).map(([id]) => id));
  if (withoutHub.length) areas.push({ id: NO_HUB_AREA_ID, hubId: null, label: '', documentIds: withoutHub });
  return { areas, areaByDocument };
};
