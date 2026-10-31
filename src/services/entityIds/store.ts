import { z } from 'zod';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { EntityOverrides } from './crossLingual';
import type { WikidataLookup } from './wikidata';

/**
 * Per-project cache of Wikidata lookups (keyed `${language}|${label}`) and manual QID corrections.
 * Decision (default chosen by agent): lookups are kept 30 days like the reference map; manual values never expire.
 */
export const ENTITY_TTL_DAYS = 30;
const DAY_MS = 86_400_000;
const MAX_LOOKUPS = 400;
export const entityStoreKey = (projectId: string) => `seomi_project_${projectId}_entity_ids_v1`;
export const lookupKey = (language: string, label: string): string => `${language}|${label.normalize('NFKC').toLocaleLowerCase().trim()}`;

const candidate = z.object({ id: z.string().regex(/^Q[1-9]\d{0,11}$/), label: z.string().max(500), description: z.string().max(1000) });
const lookup = z.union([
  z.object({ status: z.literal('ok'), candidates: z.array(candidate).max(5), fetchedAt: z.string().max(40) }),
  z.object({ status: z.enum(['blocked', 'error']), candidates: z.array(candidate).max(0), error: z.string().max(500) }),
]);
const schema = z.object({
  lookups: z.record(z.string().max(600), lookup),
  overrides: z.record(z.string().max(600), z.string().regex(/^Q[1-9]\d{0,11}$/).nullable()),
});
export interface EntityStore { lookups: Record<string, WikidataLookup>; overrides: EntityOverrides }
const EMPTY: EntityStore = { lookups: {}, overrides: {} };

const fresh = (value: WikidataLookup, now: number): boolean => value.status !== 'ok' || now - Date.parse(value.fetchedAt) < ENTITY_TTL_DAYS * DAY_MS;

/** Stored lookups past the TTL are dropped on read (failed ones stay so a retry is a user choice). */
export const readEntityStore = (projectId: string | null, now = Date.now()): EntityStore => {
  if (!projectId) return EMPTY;
  const parsed = schema.safeParse(readJsonStorage(entityStoreKey(projectId), EMPTY));
  if (!parsed.success) return EMPTY;
  const lookups = Object.fromEntries(Object.entries(parsed.data.lookups as Record<string, WikidataLookup>).filter(([, value]) => fresh(value, now)));
  return { lookups, overrides: parsed.data.overrides };
};

export const writeEntityStore = (projectId: string, store: EntityStore): boolean => {
  const lookups = Object.fromEntries(Object.entries(store.lookups).slice(-MAX_LOOKUPS));
  return writeJsonStorage(entityStoreKey(projectId), { lookups, overrides: store.overrides });
};

/** Sets (QID) or clears (empty input) a manual correction; `none` records that the topic has no entity. */
export const parseOverride = (input: string): string | null | undefined => {
  const value = input.trim().toUpperCase();
  if (!value) return undefined;
  if (value === 'NONE') return null;
  return /^Q[1-9]\d{0,11}$/.test(value) ? value : undefined;
};
