import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { focusTopicKey, validFocusProject } from './keys';

export type ManualTopic = string | string[];

const clean = (value: unknown): ManualTopic | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!Array.isArray(value)) return undefined;
  const terms = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return terms.length ? terms : undefined;
};

export const readManualTopic = (projectId: string | null | undefined): ManualTopic | undefined =>
  validFocusProject(projectId) ? clean(readJsonStorage(focusTopicKey(projectId), null)) : undefined;

/** Saves the per-project core topic override; an empty value clears it. */
export const writeManualTopic = (projectId: string, topic: ManualTopic | null | undefined): boolean => {
  if (!validFocusProject(projectId)) return false;
  const value = clean(topic);
  return value === undefined ? removeStorage(focusTopicKey(projectId)) : writeJsonStorage(focusTopicKey(projectId), value);
};
