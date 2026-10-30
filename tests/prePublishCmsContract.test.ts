import { describe, expect, it } from 'vitest';
import { CMS_LIMITS, cmsContentHash, validateCmsCheckRequest, type CmsCheckRequest } from '@/services/prePublish/cmsContract';
import { cmsChecked, cmsRejected, cmsUnavailable, isCmsResponseCurrent } from '@/services/prePublish/cmsResponse';
import { applyPolicy } from '@/services/prePublish/policy';
import { draftChunkDetails } from '@/services/prePublish/aioChunks';
import type { PrePublishReport } from '@/services/prePublish/check';

const now = new Date('2026-10-30T12:00:00Z');
const ctx = { projectId: 'p1', siteOrigin: 'https://shop.test', now, seenRequestIds: new Set<string>(['used-request-1']) };
const request = async (patch: Partial<CmsCheckRequest> = {}): Promise<CmsCheckRequest> => {
  const base = { title: 'Heat pumps', body: 'Body text of the draft.' };
  return {
    schemaVersion: 1, requestId: 'req-00000001', projectId: 'p1', site: 'https://shop.test/', revision: '42', targetUrl: 'https://shop.test/heat',
    language: 'en-GB', ...base, contentHash: await cmsContentHash(base.title, base.body), policy: 'advisory',
    issuedAt: '2026-10-30T11:59:00Z', expiresAt: '2026-10-30T12:09:00Z', ...patch,
  };
};
const validate = async (value: unknown) => validateCmsCheckRequest(JSON.stringify(value), ctx);
const report: PrePublishReport = { verdict: 'ok', publishApproved: true, draftTrs: 80, sfsBefore: 60, sfsAfter: 61, sfsDelta: 1, conflicts: [{ url: 'https://shop.test/x', similarity: 0.86, level: 'overlap' }], chunkIssues: [], reasons: [], donors: [{ url: 'https://shop.test/d', similarity: 0.7, trs: 80, alreadyLinks: null, anchor: null, placement: 'body-related-passage' }], chunkDetails: draftChunkDetails('It is.', 'en') };
const baseline = { runId: 'run-1', completedAt: '2026-10-29T00:00:00Z' };

describe('CMS pre-publish request contract (#95)', () => {
  it('accepts a valid request and computes the shared content hash', async () => {
    expect(await validate(await request())).toEqual({ ok: true, request: await request() });
    expect(await cmsContentHash('a', 'b')).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect((await validate(await request({ targetUrl: '' }))).ok).toBe(true);
  });

  it.each([
    ['unsupported-version', { schemaVersion: 2 }],
    ['invalid-payload', { requestId: 'short' }],
    ['invalid-payload', { extra: true }],
    ['invalid-payload', { site: 'ftp://shop.test' }],
    ['cross-project', { projectId: 'p2' }],
    ['site-mismatch', { site: 'https://evil.test' }],
    ['site-mismatch', { targetUrl: 'https://evil.test/heat' }],
    ['not-yet-valid', { issuedAt: '2026-10-30T12:05:00Z', expiresAt: '2026-10-30T12:10:00Z' }],
    ['expired', { expiresAt: '2026-10-30T12:00:00Z' }],
    ['ttl-too-long', { issuedAt: '2026-10-30T11:00:00Z', expiresAt: '2026-10-30T12:30:00Z' }],
    ['replay', { requestId: 'used-request-1' }],
    ['hash-mismatch', { body: 'Changed body.' }],
  ] as const)('rejects %s', async (error, patch) => {
    expect(await validate({ ...await request(), ...patch })).toEqual({ ok: false, error });
  });

  it('rejects oversized and non-JSON payloads before parsing them', async () => {
    expect(await validateCmsCheckRequest('x'.repeat(CMS_LIMITS.payloadBytes + 1), ctx)).toEqual({ ok: false, error: 'payload-too-large' });
    expect(await validateCmsCheckRequest('{', ctx)).toEqual({ ok: false, error: 'invalid-payload' });
    expect(await validateCmsCheckRequest('null', ctx)).toEqual({ ok: false, error: 'invalid-payload' });
  });
});

describe('CMS pre-publish response contract (#95)', () => {
  it('maps policy to adapter actions and never echoes the draft body', async () => {
    const advisory = await request();
    const enforced = await request({ policy: 'enforced' });
    const checked = cmsChecked(advisory, applyPolicy(report, 'advisory', []), baseline, now);
    expect(checked).toMatchObject({ status: 'checked', action: 'allow-with-advice', revision: '42', provenance: { baselineRunId: 'run-1' }, expiresAt: '2026-10-30T12:15:00.000Z' });
    expect(checked.report).toMatchObject({ donors: [{ url: 'https://shop.test/d', similarity: 0.7, trs: 80 }], weakPassages: [{ start: 0, end: 6 }] });
    expect(JSON.stringify(checked)).not.toContain(advisory.body);
    expect(cmsChecked(enforced, applyPolicy(report, 'enforced', []), baseline, now).action).toBe('allow');
    expect(cmsChecked(enforced, applyPolicy(report, 'enforced', ['stale-baseline']), baseline, now).action).toBe('hold');
    expect(cmsChecked(enforced, { ...report, chunkDetails: undefined, donors: undefined }, baseline, now).report).toMatchObject({ donors: [], weakPassages: [], evidenceGaps: [] });
    expect(cmsUnavailable(advisory, baseline, now)).toMatchObject({ status: 'unavailable', action: 'allow-with-advice', report: null, errors: ['engine-unavailable'] });
    expect(cmsUnavailable(enforced, baseline, now).action).toBe('hold');
    expect(cmsRejected('replay', baseline, now)).toMatchObject({ status: 'rejected', action: 'hold', requestId: null, errors: ['replay'] });
  });

  it('refuses a stale green report for another revision, content or after expiry', async () => {
    const checked = cmsChecked(await request(), report, baseline, now);
    const hash = (await request()).contentHash;
    expect(isCmsResponseCurrent(checked, '42', hash, now)).toBe(true);
    expect(isCmsResponseCurrent(checked, '43', hash, now)).toBe(false);
    expect(isCmsResponseCurrent(checked, '42', 'sha256:other', now)).toBe(false);
    expect(isCmsResponseCurrent(checked, '42', hash, new Date('2026-10-30T12:16:00Z'))).toBe(false);
    expect(isCmsResponseCurrent(cmsUnavailable(await request(), baseline, now), '42', hash, now)).toBe(false);
  });
});
