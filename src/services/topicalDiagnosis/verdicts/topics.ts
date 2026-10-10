import type { DiagnosisDocument, DiagnosisVerdict } from '../types';
import { NO_HUB_AREA_ID } from '../areas';
import { CANNIBALIZATION_MIN_JACCARD, CANNIBALIZATION_MIN_TITLE_TOKENS, MAX_LISTED_PAIRS } from '../thresholds';
import { urlOf, verdict, type VerdictContext } from './context';

const sharedTitleForms = (left: DiagnosisDocument, right: DiagnosisDocument): string[] =>
  [...left.titleTerms].filter((key) => right.titleTerms.has(key)).map((key) => left.titleForms.get(key) ?? key);

const sameLanguages = (left: DiagnosisDocument, right: DiagnosisDocument): boolean =>
  left.languages.join(',') === right.languages.join(',');

/**
 * Topic-level checks: a topic spread over several hubs or without one lacks a
 * pillar page; members that do not link to each other waste the topic; two
 * very similar documents in one language may compete for the same query.
 */
export const topicVerdicts = (context: VerdictContext): DiagnosisVerdict[] => {
  const { topics, byId, links, areaByDocument, pairs } = context;
  const verdicts: DiagnosisVerdict[] = [];
  topics.forEach((topic) => {
    const members = topic.documentIds.map((id) => byId.get(id)!);
    const withoutHub = members.filter((member) => (areaByDocument.get(member.id) ?? NO_HUB_AREA_ID) === NO_HUB_AREA_ID).length;
    // A member that links to every other member already acts as the topic's pillar page.
    const hasPillar = members.some((candidate) => members.every((other) => other === candidate || links.linksTo(candidate.id, other.id)));
    if ((topic.areaIds.length >= 2 || withoutHub > 0) && !hasPillar) {
      verdicts.push(verdict('topic-no-hub', 'weak', 'topic', topic.id, members, [
        { key: 'areas', params: { count: topic.areaIds.filter((area) => area !== NO_HUB_AREA_ID).length } },
        { key: 'withoutHub', params: { count: withoutHub } },
      ], members.slice(0, MAX_LISTED_PAIRS).map(urlOf)));
    }
    const unlinked: Array<[DiagnosisDocument, DiagnosisDocument]> = [];
    members.forEach((left, index) => members.slice(index + 1).forEach((right) => {
      if (!links.linksTo(left.id, right.id) && !links.linksTo(right.id, left.id)) unlinked.push([left, right]);
    }));
    if (unlinked.length) {
      verdicts.push(verdict('topic-members-unlinked', 'weak', 'topic', topic.id, members,
        [{ key: 'pairs', params: { count: unlinked.length } }],
        unlinked.slice(0, MAX_LISTED_PAIRS).flatMap(([left, right]) => [urlOf(left), urlOf(right)])));
    }
    if (members.length === 2) verdicts.push(verdict('topic-thin', 'weak', 'topic', topic.id, members));
    const memberIds = new Set(topic.documentIds);
    pairs.filter((pair) => memberIds.has(pair.left) && memberIds.has(pair.right) && pair.similarity >= CANNIBALIZATION_MIN_JACCARD).forEach((pair) => {
      const left = byId.get(pair.left)!;
      const right = byId.get(pair.right)!;
      const titleForms = sharedTitleForms(left, right);
      if (!sameLanguages(left, right) || titleForms.length < CANNIBALIZATION_MIN_TITLE_TOKENS) return;
      verdicts.push(verdict('cannibalization-candidate', 'fix', 'topic', `${topic.id}:${left.id}:${right.id}`, [left, right], [
        { key: 'similarity', params: { percent: Math.round(pair.similarity * 100) } },
        { key: 'titleTokens', params: { value: titleForms.join(', ') } },
      ]));
    });
  });
  return verdicts;
};
