import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { Clock } from './budget';
import { focusSeenKey, validFocusProject } from './keys';

export const CONTENT_GUARD_WINDOW_MS = 24 * 3_600_000;
const SEEN_LIMIT = 5000;

const readSeen = (projectId: string): Record<string, number> => {
  const raw = readJsonStorage(focusSeenKey(projectId), null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)));
};

/**
 * Records first-seen times for URLs and returns those first seen within the last 24 hours.
 * The very first registration is a baseline (time 0): existing pages are never "new".
 */
export const registerSeenUrls = (projectId: string | null | undefined, urls: string[], clock: Clock = Date.now): Set<string> => {
  if (!validFocusProject(projectId)) return new Set();
  const seen = readSeen(projectId);
  const now = clock();
  const baseline = Object.keys(seen).length === 0;
  urls.forEach((url) => { if (!(url in seen)) seen[url] = baseline ? 0 : now; });
  const kept = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, SEEN_LIMIT);
  writeJsonStorage(focusSeenKey(projectId), Object.fromEntries(kept));
  return new Set(urls.filter((url) => seen[url] > 0 && now - seen[url] <= CONTENT_GUARD_WINDOW_MS));
};
