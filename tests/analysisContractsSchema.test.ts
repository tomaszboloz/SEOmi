import { describe, expect, it } from 'vitest';
import { availability, envelope, parseEnvelope, serializeEnvelope } from '@/services/analysisContracts';

const base = { projectId: 'p1', runId: 'r1', module: 'sfs', algorithmVersion: 2, generatedAt: '2026-10-30T00:00:00Z' };
const isNumber = (value: unknown): value is number => typeof value === 'number';

describe('envelope wire contract (#85 T01/T02)', () => {
  it('round-trips an envelope unchanged through the serialized form', () => {
    const item = envelope({ ...base, value: { score: 0, terms: ['a'] }, availability: availability('partial', 'sample', 0.4), modelId: 'nomic' });
    const parsed = parseEnvelope(JSON.parse(serializeEnvelope(item)));
    expect(parsed).toEqual({ ok: true, legacy: false, envelope: item });
  });

  it('keeps a measured 0 and validates the payload type', () => {
    const zero = parseEnvelope(JSON.parse(serializeEnvelope(envelope({ ...base, value: 0 }))), isNumber);
    expect(zero.ok && zero.envelope.value).toBe(0);
    expect(parseEnvelope({ ...base, value: 'x', availability: { status: 'complete' } }, isNumber)).toEqual({ ok: false, error: 'value:invalid' });
  });

  it('reads a legacy snapshot without availability as stale, never complete', () => {
    const parsed = parseEnvelope({ projectId: 'p1', module: 'tas', generatedAt: '2025-01-01', value: 71 });
    expect(parsed).toMatchObject({ ok: true, legacy: true, envelope: { runId: null, algorithmVersion: 0, value: 71, availability: { status: 'stale', reason: 'legacy-no-availability', coverage: null } } });
  });

  it('reads a legacy snapshot without a value as unavailable null, not 0', () => {
    const parsed = parseEnvelope({ projectId: 'p1', module: 'tas', generatedAt: '2025-01-01' });
    expect(parsed).toMatchObject({ ok: true, envelope: { value: null, availability: { status: 'unavailable', reason: 'legacy-no-value' } } });
  });

  it('drops a value carried next to an error status', () => {
    const parsed = parseEnvelope({ ...base, value: 9, availability: { status: 'error', reason: 'boom' } });
    expect(parsed.ok && parsed.envelope.value).toBeNull();
  });

  it('rejects malformed records and non-finite numbers', () => {
    expect(parseEnvelope(null).ok).toBe(false);
    expect(parseEnvelope({ ...base, projectId: ' ' })).toMatchObject({ ok: false, error: 'projectId' });
    expect(parseEnvelope({ ...base, generatedAt: 'nope' }).ok).toBe(false);
    expect(parseEnvelope({ ...base, availability: { status: 'done' } }).ok).toBe(false);
    expect(parseEnvelope({ ...base, value: { nested: [1, Number.NaN] } })).toEqual({ ok: false, error: 'value:not-finite' });
    expect(parseEnvelope({ ...base, value: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(parseEnvelope({ ...base, availability: { status: 'partial', coverage: Number.NaN } }).ok).toBe(false);
  });
});
