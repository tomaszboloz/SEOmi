import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportProvenance, parseEnvelope, serializeEnvelope } from '@/services/analysisContracts';

const raw = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/envelope/round_trip.json'), 'utf8')) as unknown[];

describe('Rust envelope fixture reads back in TypeScript, MCP and PDF paths', () => {
  it('parses every Rust-emitted envelope as non-legacy', () => {
    for (const item of raw) {
      const parsed = parseEnvelope(item);
      expect(parsed.ok && !parsed.legacy).toBe(true);
    }
  });

  it('re-serializes identically (MCP payload and PDF input)', () => {
    for (const item of raw) {
      const parsed = parseEnvelope(item);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(JSON.parse(serializeEnvelope(parsed.envelope))).toEqual(item);
    }
  });

  it('keeps measured zero and null for unavailable, and exports provenance without value', () => {
    const [measured, missing] = raw.map((item) => {
      const parsed = parseEnvelope(item);
      if (!parsed.ok) throw new Error(parsed.error);
      return parsed.envelope as { value: { score: number } | null } & ReturnType<typeof Object>;
    });
    expect((measured as { value: { score: number } }).value.score).toBe(0);
    expect((missing as { value: unknown }).value).toBeNull();
    const parsed = parseEnvelope(raw[1]);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(exportProvenance(parsed.envelope)).toMatchObject({ module: 'tas', status: 'unavailable', modelId: 'nomic-embed-text' });
  });
});
