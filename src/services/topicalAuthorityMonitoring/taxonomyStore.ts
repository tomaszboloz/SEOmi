import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { TAXONOMY_VERSION, type ReferenceTaxonomy } from '@/services/topicalAuthority';
import { authorityTaxonomyKey, TAXONOMY_TTL_DAYS, validAuthorityProject } from './keys';

const DAY_MS = 86_400_000;

const isTaxonomy = (value: unknown): value is ReferenceTaxonomy => {
  const item = value as Partial<ReferenceTaxonomy> | null;
  return Boolean(item) && typeof item === 'object' && item?.version === TAXONOMY_VERSION && typeof item.builtAt === 'string'
    && Array.isArray(item.pillars) && Array.isArray(item.subtopics) && item.subtopics.length > 0 && typeof item.commonTerms === 'object' && item.commonTerms !== null;
};

/** Cached reference taxonomy of the project, or null when absent, malformed or older than 30 days. */
export const readTaxonomy = (projectId: string | null | undefined, now: number = Date.now()): ReferenceTaxonomy | null => {
  if (!validAuthorityProject(projectId)) return null;
  const raw = readJsonStorage(authorityTaxonomyKey(projectId), null);
  if (!isTaxonomy(raw)) return null;
  const age = now - Date.parse(raw.builtAt);
  return Number.isFinite(age) && age <= TAXONOMY_TTL_DAYS * DAY_MS ? raw : null;
};

export const writeTaxonomy = (projectId: string | null | undefined, taxonomy: ReferenceTaxonomy): boolean =>
  validAuthorityProject(projectId) ? writeJsonStorage(authorityTaxonomyKey(projectId), taxonomy) : false;

export const clearTaxonomy = (projectId: string | null | undefined): boolean =>
  validAuthorityProject(projectId) ? removeStorage(authorityTaxonomyKey(projectId)) : false;

const fold = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * A cached map is only reused for the same Core Topic and content language; a map built for another topic or
 * language would give a wrong TCR, so it is treated as absent until rebuilt.
 */
export const taxonomyMatchesCore = (taxonomy: ReferenceTaxonomy, core: { coreLabel: string; language: string }): boolean =>
  fold(taxonomy.coreLabel) === fold(core.coreLabel) && (!taxonomy.language || !core.language || fold(taxonomy.language) === fold(core.language));
