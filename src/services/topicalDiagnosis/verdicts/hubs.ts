import type { DiagnosisVerdict } from '../types';
import { MAX_LISTED_PAIRS } from '../thresholds';
import { contentDocuments, urlOf, verdict, type VerdictContext } from './context';

/**
 * A hub should link to every document of its topics from its main content, and
 * every member should link back to its hub from anywhere on the page (a
 * breadcrumb or a category link in the navigation counts).
 */
export const hubVerdicts = (context: VerdictContext): DiagnosisVerdict[] => {
  const { areas, byId, links, allLinks, topicByDocument } = context;
  const verdicts: DiagnosisVerdict[] = [];
  const content = contentDocuments(context);
  areas.forEach((area) => {
    if (!area.hubId) return;
    const hub = byId.get(area.hubId)!;
    const members = area.documentIds.map((id) => byId.get(id)!);
    const missingBacklink = members.filter((member) => !allLinks.linksTo(member.id, hub.id));
    missingBacklink.forEach((member) => verdicts.push(verdict(
      'hub-missing-backlink', 'fix', 'document', member.id, [member, hub], [{ key: 'hub', params: { hub: urlOf(hub) } }], [urlOf(member)],
    )));
    // Same-section documents of the hub's topics that the hub does not link to at all (membership in a narrower area is not a gap).
    const memberTopics = new Set(area.documentIds.map((id) => topicByDocument.get(id)).filter(Boolean));
    const unlisted = content.filter((document) => document.section === hub.section && !links.linksTo(hub.id, document.id)
      && topicByDocument.has(document.id) && memberTopics.has(topicByDocument.get(document.id)));
    if (members.length && !missingBacklink.length && !unlisted.length) {
      verdicts.push(verdict('area-healthy', 'good', 'area', area.id, [hub, ...members], [{ key: 'members', params: { count: members.length } }], [urlOf(hub)]));
    }
    if (unlisted.length) {
      verdicts.push(verdict(
        'hub-missing-member-link', 'weak', 'area', area.id, [hub, ...unlisted],
        [{ key: 'count', params: { count: unlisted.length } }, { key: 'hub', params: { hub: urlOf(hub) } }],
        unlisted.slice(0, MAX_LISTED_PAIRS).map(urlOf),
      ));
    }
  });
  return verdicts;
};
