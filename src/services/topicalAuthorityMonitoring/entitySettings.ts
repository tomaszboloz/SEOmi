import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { ENTITY_MODES, type EntityMode } from '@/services/topicalAuthority';
import { validAuthorityProject } from './keys';

export interface EntitySettings { mode: EntityMode; model: string }
const key = (projectId: string): string => `seomi_project_${projectId}_authority_entities_v1`;
export const DEFAULT_ENTITY_SETTINGS: EntitySettings = { mode: 'lexical', model: '' };

/** Per-project entity recognition choice. Default `lexical` keeps historical scores comparable; `ollama` needs a local model name. */
export const readEntitySettings = (projectId: string | null | undefined): EntitySettings => {
  if (!validAuthorityProject(projectId)) return DEFAULT_ENTITY_SETTINGS;
  const raw = readJsonStorage(key(projectId), null) as Partial<EntitySettings> | null;
  const mode = ENTITY_MODES.find((item) => item === raw?.mode) ?? 'lexical';
  return { mode, model: typeof raw?.model === 'string' ? raw.model.trim().slice(0, 120) : '' };
};

export const writeEntitySettings = (projectId: string | null | undefined, settings: EntitySettings): boolean =>
  validAuthorityProject(projectId) ? writeJsonStorage(key(projectId), { mode: settings.mode, model: settings.model.trim().slice(0, 120) }) : false;
