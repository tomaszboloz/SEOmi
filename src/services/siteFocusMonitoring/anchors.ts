import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { MAX_ANCHOR_URL_LENGTH, MAX_ANCHORS } from '@/services/siteFocus/anchors';
import { notifyFocusConfigChanged } from './configEvents';
import { focusAnchorsKey, validFocusProject } from './keys';

/** Trimmed, de-duplicated http(s) URLs within the engine's input caps; anything else is dropped, not repaired. */
export const cleanAnchorUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const urls = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
    .filter((item) => /^https?:\/\/\S+$/i.test(item) && item.length <= MAX_ANCHOR_URL_LENGTH);
  return [...new Set(urls)].slice(0, MAX_ANCHORS);
};

/** One URL per line (or comma separated), as typed in the Core Topic panel. */
export const parseAnchorInput = (text: string): string[] => cleanAnchorUrls(text.split(/[\n,]+/));

export const readAnchorUrls = (projectId: string | null | undefined): string[] =>
  validFocusProject(projectId) ? cleanAnchorUrls(readJsonStorage(focusAnchorsKey(projectId), null)) : [];

/** Saves the per-project anchor pages; an empty list clears them so auto mode applies again. */
export const writeAnchorUrls = (projectId: string, urls: readonly string[] | null | undefined): boolean => {
  if (!validFocusProject(projectId)) return false;
  const value = cleanAnchorUrls(urls ?? []);
  const saved = value.length ? writeJsonStorage(focusAnchorsKey(projectId), value) : removeStorage(focusAnchorsKey(projectId));
  notifyFocusConfigChanged(projectId);
  return saved;
};
