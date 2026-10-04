import { create } from 'zustand';
import { SeoProject } from '@/types';
import { validateProjectName, validateProjectRootUrl } from '@/services/projectValidation';
import { createId } from '@/services/ids';
import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from '@/services/storage';
import i18n from '@/i18n';

const PROJECTS_KEY = 'seomi_projects_v1';
const ACTIVE_PROJECT_KEY = 'seomi_active_project_v1';

const validIsoDate = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
};

/**
 * Keep malformed or stale WebView storage from becoming an active workspace.
 * This is an in-memory read boundary; it deliberately does not rewrite or
 * migrate the persisted catalog until the user creates/selects a valid project.
 */
export const normalizePersistedProjects = (value: unknown, now = new Date().toISOString()): SeoProject[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: SeoProject[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const raw = candidate as Partial<SeoProject>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id) || seen.has(id)) continue;
    const nameValidation = validateProjectName(typeof raw.name === 'string' ? raw.name : '');
    if (!nameValidation.ok) continue;
    const rootValidation = validateProjectRootUrl(typeof raw.rootUrl === 'string' ? raw.rootUrl : undefined);
    if (!rootValidation.ok) continue;
    seen.add(id);
    normalized.push({
      id,
      name: nameValidation.value,
      rootUrl: rootValidation.value,
      createdAt: validIsoDate(raw.createdAt, now),
      lastOpenedAt: validIsoDate(raw.lastOpenedAt, now),
    });
  }
  return normalized;
};

const loadProjects = (): SeoProject[] => normalizePersistedProjects(readJsonStorage(PROJECTS_KEY, []));

const save = (projects: SeoProject[], activeProjectId: string | null): void => {
  const projectsSaved = writeJsonStorage(PROJECTS_KEY, projects);
  const activeSaved = activeProjectId ? writeStorage(ACTIVE_PROJECT_KEY, activeProjectId) : true;
  if (!projectsSaved || !activeSaved) {
    throw new Error(i18n.t('runtimeErrors.persistence.workspaceUnavailable'));
  }
};

interface ProjectState {
  projects: SeoProject[];
  activeProjectId: string | null;
  createProject: (input: { name: string; rootUrl?: string; activate?: boolean }) => SeoProject;
  selectProject: (id: string) => void;
}

const projects = loadProjects();
const savedActiveId = readStorage(ACTIVE_PROJECT_KEY);

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects,
  activeProjectId: projects.some((project) => project.id === savedActiveId) ? savedActiveId : null,
  createProject: ({ name, rootUrl, activate = true }) => {
    const nameValidation = validateProjectName(name);
    if (!nameValidation.ok) throw new Error(nameValidation.message);
    const rootValidation = validateProjectRootUrl(rootUrl);
    if (!rootValidation.ok) throw new Error(rootValidation.message);
    const now = new Date().toISOString();
    const project: SeoProject = { id: createId('project'), name: nameValidation.value, rootUrl: rootValidation.value, createdAt: now, lastOpenedAt: now };
    const updated = [project, ...get().projects];
    const activeProjectId = activate ? project.id : get().activeProjectId;
    save(updated, activeProjectId);
    set({ projects: updated, activeProjectId });
    return project;
  },
  selectProject: (id) => {
    if (!get().projects.some((project) => project.id === id)) return;
    const updated = get().projects.map((project) => project.id === id ? { ...project, lastOpenedAt: new Date().toISOString() } : project);
    save(updated, id);
    set({ projects: updated, activeProjectId: id });
  },
}));
