import type { DiagnosisDocument, DiagnosisVerdict } from '../types';
import { MAX_LISTED_PAIRS, NEAR_DUPLICATE_MAX_HAMMING } from '../thresholds';
import { contentDocuments, urlOf, verdict, type VerdictContext } from './context';

/** Bits that differ between two 64-bit SimHash hex strings; null when either is not a hash. */
const hammingDistance = (left: string | null | undefined, right: string | null | undefined): number | null => {
  if (!left || !right || !/^[a-f\d]{16}$/i.test(left) || !/^[a-f\d]{16}$/i.test(right)) return null;
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (bits) {
    count += Number(bits & 1n);
    bits >>= 1n;
  }
  return count;
};

const groupVerdict = (
  severity: 'fix' | 'weak', kind: 'same' | 'near', members: DiagnosisDocument[], evidence: DiagnosisVerdict['evidence'],
): DiagnosisVerdict => verdict(
  'near-duplicate', severity, 'document',
  members.length === 2 ? `${members[0].id}:${members[1].id}` : `${members[0].id}:${kind}-${members.length}`,
  members, members.length === 2 ? evidence : [...evidence, { key: 'count', params: { count: members.length } }],
  members.slice(0, MAX_LISTED_PAIRS).map(urlOf),
);

/**
 * Identical and nearly identical text among content documents of one language.
 * Copies are reported as groups: thirty empty tag pages are one finding, not
 * 435 pairs. A group of identical pages is compared further through its first
 * page only.
 */
export const duplicateVerdicts = (context: VerdictContext): DiagnosisVerdict[] => {
  const verdicts: DiagnosisVerdict[] = [];
  const identical = new Map<string, DiagnosisDocument[]>();
  const units: DiagnosisDocument[] = [];
  contentDocuments(context).forEach((document) => {
    const hash = document.primaryPage.content_hash;
    const key = hash ? `${document.languages.join(',')}|${hash}` : null;
    const group = key ? identical.get(key) : undefined;
    if (group) group.push(document);
    else {
      if (key) identical.set(key, [document]);
      units.push(document);
    }
  });
  identical.forEach((members) => {
    if (members.length > 1) verdicts.push(groupVerdict('fix', 'same', members, [{ key: 'hash', params: { value: members[0].primaryPage.content_hash! } }]));
  });
  // Union-find over the remaining representatives: a chain of near copies is one group.
  const root = units.map((_, index) => index);
  const widest = units.map(() => 0);
  const find = (index: number): number => (root[index] === index ? index : find(root[index]));
  units.forEach((left, leftIndex) => units.slice(leftIndex + 1).forEach((right, offset) => {
    if (left.languages.join(',') !== right.languages.join(',')) return;
    const distance = hammingDistance(left.primaryPage.content_simhash, right.primaryPage.content_simhash);
    if (distance === null || distance > NEAR_DUPLICATE_MAX_HAMMING) return;
    const [low, high] = [find(leftIndex), find(leftIndex + 1 + offset)].sort((a, b) => a - b);
    root[high] = low;
    widest[low] = Math.max(widest[low], widest[high], distance);
  }));
  const near = new Map<number, DiagnosisDocument[]>();
  units.forEach((unit, index) => near.set(find(index), [...(near.get(find(index)) ?? []), unit]));
  near.forEach((members, low) => {
    if (members.length > 1) verdicts.push(groupVerdict('weak', 'near', members, [{ key: 'distance', params: { value: widest[low] } }]));
  });
  return verdicts;
};
