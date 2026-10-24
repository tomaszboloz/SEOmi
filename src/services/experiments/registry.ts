import { z } from 'zod';
import { createId } from '@/services/ids';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { scopeOf } from '@/services/urlTelemetry/urlKey';

export const interventionKinds = ['content', 'internal-links', 'title-meta', 'technical', 'other'] as const;
export const interventionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().trim().min(1),
  url: z.string().refine(value => value === 'site' || scopeOf(value) !== null),
  date: z.iso.date(),
  kind: z.enum(interventionKinds),
  note: z.string().max(300),
  createdAt: z.iso.datetime(),
});
export type Intervention = z.infer<typeof interventionSchema>;
export type NewIntervention = Pick<Intervention, 'url' | 'date' | 'kind' | 'note'>;
export const experimentsKey = (projectId: string): string => `seomi_project_${projectId}_experiments_v1`;
const recordsSchema = z.record(z.string(), z.unknown());
const limit = 200;

export const listInterventions = (projectId: string): Intervention[] => {
  if (!projectId.trim()) return [];
  const records = recordsSchema.safeParse(readJsonStorage(experimentsKey(projectId), {}));
  if (!records.success) return [];
  return Object.entries(records.data).flatMap(([id, value]) => {
    const entry = interventionSchema.safeParse(value);
    return entry.success && entry.data.projectId === projectId && entry.data.id === id ? [entry.data] : [];
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit);
};

const persist = (projectId: string, entries: Intervention[]): boolean =>
  writeJsonStorage(experimentsKey(projectId), Object.fromEntries(entries.map(entry => [entry.id, entry])));

export const addIntervention = (projectId: string, input: NewIntervention, now = new Date()): Intervention | null => {
  const parsed = interventionSchema.safeParse({ ...input, projectId, id: createId('experiment'), createdAt: now.toISOString() });
  if (!parsed.success || parsed.data.projectId !== projectId) return null;
  const entries = [parsed.data, ...listInterventions(projectId)].slice(0, limit);
  return persist(projectId, entries) ? parsed.data : null;
};

export const removeIntervention = (projectId: string, id: string): boolean => {
  if (!projectId.trim()) return false;
  return persist(projectId, listInterventions(projectId).filter(entry => entry.id !== id));
};
