import type { TopicalEntityFact } from './types';
import { cleanText, validHttpUrl, id } from './primitives';
export const normalizeFact = (raw: unknown): TopicalEntityFact | null => {
  if (!raw || typeof raw !== 'object') return null;
  const fact = raw as Record<string, unknown>;
  const attribute = cleanText(fact.attribute, 120);
  const value = cleanText(fact.value, 1000);
  if (!attribute || !value) return null;
  const sourceUrl = validHttpUrl(fact.sourceUrl) ?? '';
  return {
    id: cleanText(fact.id, 100) || id(), attribute, value, sourceUrl,
    // Existing records remain locked until a user explicitly verifies them.
    reuseStatus: sourceUrl && fact.reuseStatus === 'verified' ? 'verified' : 'locked',
  };
};
