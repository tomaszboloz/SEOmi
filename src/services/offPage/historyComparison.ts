import type { OffPageHistoryRecord } from './historySchema';

export type HistoryComparison = { delta: number; reason?: never }
  | { delta?: never; reason: 'first' | 'scale' | 'model' | 'unknownModel' | 'unavailable' };

export const compareOffPageHistory = (current: OffPageHistoryRecord, previous?: OffPageHistoryRecord): HistoryComparison => {
  if (!previous) return { reason: 'first' };
  if (current.scale !== previous.scale) return { reason: 'scale' };
  if (!current.embeddingModelId || !previous.embeddingModelId) return { reason: 'unknownModel' };
  if (current.embeddingProvider !== previous.embeddingProvider || current.embeddingModelId !== previous.embeddingModelId) {
    return { reason: 'model' };
  }
  if (current.tbva.value === null || previous.tbva.value === null) return { reason: 'unavailable' };
  return { delta: Math.round((current.tbva.value - previous.tbva.value) * 1000) / 1000 };
};
