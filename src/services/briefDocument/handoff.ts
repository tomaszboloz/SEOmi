import type { TopicalNode, TopicalContentBrief } from '@/services/topicalMap';
import type { ContentBriefExportPayload } from './types';
import { briefText } from './primitives';

/** Serialize only user-entered brief data for an explicit local handoff. */
export const buildContentBriefExport = (
  node: TopicalNode,
  brief: TopicalContentBrief,
  exportedAt = new Date().toISOString(),
): ContentBriefExportPayload => ({
  schemaVersion: 1,
  exportedAt,
  node: { id: node.id, title: node.title, lifecycle: node.lifecycle },
  brief,
});

/** Markdown handoff intentionally keeps provenance labels and does not invent claims. */
export const buildContentBriefMarkdown = (node: TopicalNode, brief: TopicalContentBrief): string => {
  const query = node.queries.find((item) => item.id === brief.targetQueryId);
  const sections = [
    `# ${node.title.trim() || briefText('draftTitle')}`,
    '',
    briefText('stage') + `: ${node.lifecycle}`,
    briefText('primaryQuery') + `: ${query?.text || briefText('notSelected')}`,
    briefText('formatGoal') + `: ${brief.snippetTarget}`,
    '',
    `## ${briefText('requiredEntities')}`,
    ...(brief.requiredEntities.length ? brief.requiredEntities.map((item) => `- ${item}`) : [`- ${briefText('noEntities')}`]),
    '',
    `## ${briefText('internalLinks')}`,
    ...(brief.internalLinkTargets.length ? brief.internalLinkTargets.map((url) => `- ${url}`) : [`- ${briefText('noTargets')}`]),
    '',
    `## ${briefText('draft')}`,
    brief.draftMarkdown || `_${briefText('noDraft')}_`,
    '',
    `> ${briefText('exportNote')}`,
  ];
  return sections.join('\n');
};
