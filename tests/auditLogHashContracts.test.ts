import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, appendAudit, sha256Hex, verifyChain } from '@/services/team/auditLog';

const input = { actor: 'ann', role: 'admin', action: 'run_crawl', projectId: 'p1', result: 'success' } as const;
const now = new Date('2026-01-02T03:04:05.000Z');

describe('audit log hashing', () => {
  it('matches published SHA-256 vectors, including UTF-8 input', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex('zażółć')).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('zażółć')).not.toBe(await sha256Hex('zazolc'));
  });

  it('chains entries from the genesis hash and detects tampering', async () => {
    const one = await appendAudit([], input, 'id1', now);
    const two = await appendAudit(one, { ...input, action: 'export_audit_pdf' }, 'id2', now);
    expect(one[0]).toMatchObject({ seq: 1, prevHash: GENESIS_HASH, at: now.toISOString() });
    expect(two[1].prevHash).toBe(one[0].hash);
    expect(await verifyChain(two)).toEqual({ ok: true });
    const tampered = [{ ...two[0], actor: 'eve' }, two[1]];
    expect(await verifyChain(tampered)).toEqual({ ok: false, brokenAt: 0, reason: 'hash' });
    expect(await verifyChain([two[1]])).toMatchObject({ ok: false, brokenAt: 0 });
  });
});
