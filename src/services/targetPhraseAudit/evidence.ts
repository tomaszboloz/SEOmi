import type { PageAuditData, HeadingNode } from '@/types';
import type { PhraseEvidenceField, PhraseFieldEvidence, TargetPhraseAudit, TargetPhraseIntent } from './types';

const MAX_EXCERPT = 180;
const MAX_EVIDENCE = 6;

const flatten = (nodes: readonly HeadingNode[] = []): HeadingNode[] => nodes.flatMap((node) => [node, ...flatten(node.children)]);

const count = (value: string, phrase: string): number => {
  let total = 0;
  let offset = 0;
  const source = value.toLocaleLowerCase();
  const needle = phrase.toLocaleLowerCase();
  while (offset <= source.length - needle.length) {
    const found = source.indexOf(needle, offset);
    if (found < 0) break;
    total += 1;
    offset = found + needle.length;
  }
  return total;
};

const excerpt = (value: string, phrase: string): string => {
  if (value.length <= MAX_EXCERPT) return value;
  const at = value.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
  const start = Math.max(0, at - 70);
  const end = Math.min(value.length, at + phrase.length + 90);
  return `${start ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`;
};

const field = (fieldName: PhraseEvidenceField, values: string[], phrase: string): PhraseFieldEvidence => ({
  field: fieldName,
  occurrences: values.reduce((total, value) => total + count(value, phrase), 0),
  evidence: values.filter((value) => value.toLocaleLowerCase().includes(phrase.toLocaleLowerCase())).slice(0, MAX_EVIDENCE).map((value) => excerpt(value, phrase)),
});

/** Accept only one exact provider intent; phrase text never supplies intent. */
export const normalizeProviderIntent = (value: string | null | undefined): TargetPhraseIntent | null => {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized === 'informational' || normalized === 'commercial' || normalized === 'transactional' || normalized === 'navigational'
    ? normalized
    : null;
};

export const buildTargetPhraseAudit = (
  audit: PageAuditData,
  input: string,
  providerIntent?: string | null,
): TargetPhraseAudit | null => {
  const phrase = input.trim();
  if (!phrase) return null;
  const headings = flatten(audit.headings?.hierarchy);
  const h1 = headings.filter((heading) => heading.level === 1).map((heading) => heading.text).filter(Boolean);
  const fallbackH1 = audit.headings?.h1_texts?.filter(Boolean) || [];
  const body = audit.content_stats?.body_text || '';
  const evidence = [
    field('title', audit.meta_tags?.title ? [audit.meta_tags.title] : [], phrase),
    field('h1', h1.length ? h1 : fallbackH1, phrase),
    field('body', body ? [body] : [], phrase),
    field('anchors', (audit.links?.links || []).map((link) => link.text).filter(Boolean), phrase),
  ];
  const completenessReasons: string[] = [];
  if (!body) completenessReasons.push('body-unavailable');
  if (audit.content_stats?.body_text_truncated) completenessReasons.push('body-truncated');
  const intent = normalizeProviderIntent(providerIntent);
  return {
    phrase,
    url: audit.final_url || audit.url || '',
    timestamp: audit.timestamp || '',
    intent,
    intentSource: intent ? 'provider' : 'unavailable',
    completeness: completenessReasons.length ? 'partial' : 'complete',
    completenessReasons,
    evidence,
  };
};
