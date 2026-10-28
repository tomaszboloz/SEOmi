import i18n from '@/i18n';
import { saveDraftVersion } from '@/services/briefDocument/versions';
import { createTopicalNode } from '@/services/topicalDocument/factories';
import { cleanText, MAX_NODES } from '@/services/topicalDocument/primitives';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalDocument/types';

export interface AcceptedRewrite {
  url: string;
  title: string;
  heading: string;
  revision: string;
  before: string;
  after: string;
}

export interface AcceptResult { document: TopicalMapDocument; nodeId: string | null; versionNote: string }

const MAX_DRAFT = 50_000;
const start = (revision: string): string => `<!-- seomi-aio-rewrite:${revision}:start -->`;
const end = (revision: string): string => `<!-- seomi-aio-rewrite:${revision}:end -->`;

/** Managed block keyed by passage revision; accepting the same revision again replaces it, never duplicates. */
export const buildRewriteBlock = (input: AcceptedRewrite): string => [
  start(input.revision),
  `## ${i18n.t('aio.passage.brief.heading', { heading: input.heading || i18n.t('aio.passage.noHeading') })}`,
  `> ${i18n.t('aio.passage.brief.unverified')}`,
  `### ${i18n.t('aio.passage.brief.original')}`, input.before, `### ${i18n.t('aio.passage.brief.rewritten')}`, input.after,
  end(input.revision),
].join('\n');

const upsert = (draft: string, input: AcceptedRewrite): string => {
  const block = buildRewriteBlock(input);
  const from = draft.indexOf(start(input.revision));
  const to = draft.indexOf(end(input.revision));
  if (from >= 0 && to > from) return `${draft.slice(0, from)}${block}${draft.slice(to + end(input.revision).length)}`;
  return draft.trim() ? `${draft.trimEnd()}\n\n${block}` : block;
};

/**
 * Manual accept only: adds the rewritten passage to the page's brief draft and saves a numbered draft version.
 * Pure; the caller persists. Returns nodeId null when the brief cannot be created (node limit or oversized draft).
 */
export const acceptRewriteIntoBrief = (document: TopicalMapDocument, input: AcceptedRewrite, savedAt = new Date().toISOString()): AcceptResult => {
  const existing = document.nodes.find((node) => node.sourceUrls.includes(input.url));
  const none = { document, nodeId: null, versionNote: '' };
  if (!existing && document.nodes.length >= MAX_NODES) return none;
  const node: TopicalNode = existing ?? { ...createTopicalNode(cleanText(input.title, 180)), sourceUrls: [input.url] };
  const draftMarkdown = upsert(node.contentBrief.draftMarkdown, input);
  if (draftMarkdown.length > MAX_DRAFT) return none;
  const versionNote = i18n.t('aio.passage.brief.versionNote', { n: node.contentBrief.draftVersions.length + 1, revision: input.revision });
  const contentBrief = saveDraftVersion({ ...node.contentBrief, draftMarkdown }, versionNote, savedAt);
  const updated: TopicalNode = { ...node, lifecycle: node.lifecycle === 'planned' ? 'briefed' : node.lifecycle, contentBrief };
  const nodes = existing ? document.nodes.map((item) => (item.id === node.id ? updated : item)) : [...document.nodes, updated];
  return { document: { ...document, nodes }, nodeId: updated.id, versionNote };
};
