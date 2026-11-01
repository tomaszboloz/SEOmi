import { z } from 'zod';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import type { AliasSense } from './aliasSense';

const words = z.array(z.string().trim().min(1).max(60)).max(20).optional();
const schema = z.array(z.object({ alias: z.string().trim().min(1).max(60), excludeContext: words, requireContext: words })).max(20);
const key = (projectId: string) => `seomi.offpage.aliasSenses.${projectId}`;
const list = (value: string) => value.split(',').map((word) => word.trim()).filter(Boolean);

/** One rule per line: `Alias | -exclude, words | +require, words` (either part optional). */
export const parseAliasSenses = (text: string): AliasSense[] => text.split('\n').flatMap((line) => {
  const [alias = '', ...parts] = line.split('|').map((part) => part.trim());
  if (!alias) return [];
  const pick = (mark: string) => parts.filter((part) => part.startsWith(mark)).flatMap((part) => list(part.slice(1)));
  const excludeContext = pick('-');
  const requireContext = pick('+');
  return [{ alias, ...(excludeContext.length ? { excludeContext } : {}), ...(requireContext.length ? { requireContext } : {}) }];
});

export const formatAliasSenses = (senses: AliasSense[]): string => senses.map((sense) => [sense.alias,
  ...(sense.excludeContext?.length ? [`-${sense.excludeContext.join(', ')}`] : []),
  ...(sense.requireContext?.length ? [`+${sense.requireContext.join(', ')}`] : [])].join(' | ')).join('\n');

export const loadAliasSenses = (projectId: string | null): AliasSense[] => {
  if (!projectId) return [];
  const raw = readStorage(key(projectId));
  if (raw === null) return [];
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch { /* corrupt entry falls through to removal */ }
  removeStorage(key(projectId));
  return [];
};

export const saveAliasSenses = (projectId: string | null, senses: AliasSense[]): boolean => {
  const parsed = schema.safeParse(senses);
  if (!projectId || !parsed.success) return false;
  return parsed.data.length ? writeStorage(key(projectId), JSON.stringify(parsed.data)) : removeStorage(key(projectId));
};
