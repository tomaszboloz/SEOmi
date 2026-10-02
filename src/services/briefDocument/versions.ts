import type { ContentBriefVersion, TopicalContentBrief } from '@/services/topicalMap';
import { createId } from '@/services/ids';

const MAX_DRAFT_VERSIONS = 30;
const versionId = () => createId('draft');

/**
 * Save an explicit local checkpoint. A checkpoint is never created implicitly
 * on every keystroke, so a long draft cannot fill workspace storage while it
 * is being edited. Consecutive identical drafts are de-duplicated.
 */
export const saveDraftVersion = (
  brief: TopicalContentBrief,
  note = '',
  savedAt = new Date().toISOString(),
): TopicalContentBrief => {
  const draftMarkdown = brief.draftMarkdown.trim() ? brief.draftMarkdown : '';
  if (!draftMarkdown) return brief;
  const normalizedNote = note.trim().slice(0, 240);
  const latest = brief.draftVersions[0];
  if (latest?.draftMarkdown === draftMarkdown && latest.note === normalizedNote) return brief;
  const version: ContentBriefVersion = {
    id: versionId(),
    savedAt,
    note: normalizedNote,
    draftMarkdown,
  };
  return { ...brief, draftVersions: [version, ...brief.draftVersions].slice(0, MAX_DRAFT_VERSIONS) };
};
