import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { cleanBrandList } from '@/services/siteFocus/brandPolicy';
import type { BrandPolicyInput } from '@/services/siteFocus/types';
import { notifyFocusConfigChanged } from './configEvents';
import { focusBrandKey, validFocusProject } from './keys';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Validated brand dictionary (#56); unknown fields and invalid entries are dropped, not repaired. */
export const cleanBrandInput = (value: unknown): BrandPolicyInput => {
  if (!isRecord(value)) return {};
  const lists = { aliases: cleanBrandList(value.aliases), competitors: cleanBrandList(value.competitors), exceptions: cleanBrandList(value.exceptions) };
  return Object.fromEntries(Object.entries(lists).filter(([, list]) => list.length));
};

/** One term per line (or comma separated), as typed in the brand dictionary panel. */
export const parseBrandInput = (text: string): string[] => cleanBrandList(text.split(/[\n,]+/));

export const readBrandPolicy = (projectId: string | null | undefined): BrandPolicyInput =>
  validFocusProject(projectId) ? cleanBrandInput(readJsonStorage(focusBrandKey(projectId), null)) : {};

/** Saves the per-project brand dictionary; an empty dictionary clears it so only the domain rule applies. */
export const writeBrandPolicy = (projectId: string, input: BrandPolicyInput | null | undefined): boolean => {
  if (!validFocusProject(projectId)) return false;
  const value = cleanBrandInput(input ?? {});
  const saved = Object.keys(value).length ? writeJsonStorage(focusBrandKey(projectId), value) : removeStorage(focusBrandKey(projectId));
  notifyFocusConfigChanged(projectId);
  return saved;
};
