import { expect, it } from 'vitest';
import { compareOffPageHistory } from '@/services/offPage/historyComparison';
import { historyRecord } from './fixtures/offPageHistory';

it('compares signed TBVA deltas only in the same model and authority scale', () => {
  const previous = historyRecord();
  expect(compareOffPageHistory(historyRecord({ tbva: { ...previous.tbva, value: 1.1234 } }), previous)).toEqual({ delta: 0.323 });
  expect(compareOffPageHistory(historyRecord({ tbva: { ...previous.tbva, value: 0 } }), previous)).toEqual({ delta: -0.8 });
  expect(compareOffPageHistory(previous, previous)).toEqual({ delta: 0 });
});

it('explains why a comparison is unavailable', () => {
  const record = historyRecord();
  expect(compareOffPageHistory(record)).toEqual({ reason: 'first' });
  expect(compareOffPageHistory(record, historyRecord({ scale: 10 }))).toEqual({ reason: 'scale' });
  expect(compareOffPageHistory(record, historyRecord({ embeddingModelId: 'other' }))).toEqual({ reason: 'model' });
  expect(compareOffPageHistory(record, historyRecord({ embeddingProvider: 'other' }))).toEqual({ reason: 'model' });
  for (const pair of [[record, historyRecord({ embeddingModelId: null })], [historyRecord({ embeddingModelId: null }), record]]) {
    expect(compareOffPageHistory(pair[0], pair[1])).toEqual({ reason: 'unknownModel' });
  }
  const unavailable = historyRecord({ tbva: { value: null, status: 'unavailable', limitations: [] } });
  expect(compareOffPageHistory(record, unavailable)).toEqual({ reason: 'unavailable' });
  expect(compareOffPageHistory(unavailable, record)).toEqual({ reason: 'unavailable' });
});
