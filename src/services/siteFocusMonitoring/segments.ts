import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { cleanSegments } from '@/services/siteFocus/segments';
import type { FocusSegmentInput } from '@/services/siteFocus/types';
import { focusSegmentsKey, validFocusProject } from './keys';

/** Saved user segments of a multi-topic site (#82 GEM-82-05); a stored value that no longer validates is dropped. */
export const readFocusSegments = (projectId: string | null | undefined): FocusSegmentInput[] =>
  validFocusProject(projectId) ? cleanSegments(readJsonStorage(focusSegmentsKey(projectId), [])) : [];

/** Saves the cleaned segments; an empty list removes the setting. Returns what was kept. */
export const writeFocusSegments = (projectId: string, segments: readonly FocusSegmentInput[]): FocusSegmentInput[] => {
  const cleaned = cleanSegments(segments);
  if (!validFocusProject(projectId)) return cleaned;
  if (cleaned.length) writeJsonStorage(focusSegmentsKey(projectId), cleaned);
  else removeStorage(focusSegmentsKey(projectId));
  return cleaned;
};
