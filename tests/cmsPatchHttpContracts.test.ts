import { describe, expect, it, vi } from 'vitest';
import { CMS_TIMEOUT_MS, asString, call, json, record } from '@/services/cmsPatch/http';
import type { CmsResponse, CmsTarget } from '@/services/cmsPatch/types';

const target: CmsTarget = { kind: 'wordpress', baseUrl: 'https://x.example', contentId: '1', credential: 'cred-name' };
const reply = (status: number, body = '{}'): CmsResponse => ({ status, headers: {}, body });

describe('cmsPatch http helpers', () => {
  it('sends credential by name, never follows redirects, adds body and If-Match headers', async () => {
    const send = vi.fn().mockResolvedValue(reply(200));
    await call(send, target, 'PUT', 'https://x.example/p', { body: { a: 1 }, ifMatch: 'rev1' });
    expect(send).toHaveBeenCalledWith({
      method: 'PUT', url: 'https://x.example/p', credential: 'cred-name', followRedirects: false, timeoutMs: CMS_TIMEOUT_MS, body: '{"a":1}',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'If-Match': 'rev1' },
    });
    await call(send, target, 'GET', 'https://x.example/p');
    const get = send.mock.calls[1][0];
    expect(get.headers).toEqual({ Accept: 'application/json' });
    expect('body' in get).toBe(false);
  });

  it('maps 409/412 to conflict and other non-2xx to http errors', async () => {
    for (const status of [409, 412]) {
      await expect(call(async () => reply(status), target, 'GET', 'u')).rejects.toMatchObject({ name: 'CmsError', code: 'conflict', status });
    }
    await expect(call(async () => reply(500), target, 'GET', 'u')).rejects.toMatchObject({ code: 'http', status: 500 });
    await expect(call(async () => reply(199), target, 'GET', 'u')).rejects.toMatchObject({ code: 'http' });
    await expect(call(async () => reply(204), target, 'GET', 'u')).resolves.toMatchObject({ status: 204 });
  });

  it('parses only JSON objects and narrows values safely', () => {
    expect(json(reply(200, '{"a":1}'))).toEqual({ a: 1 });
    for (const body of ['[1]', 'null', '"s"', 'not json']) {
      expect(() => json(reply(200, body))).toThrow(expect.objectContaining({ code: 'bad-response' }));
    }
    expect(asString('x')).toBe('x');
    expect(asString(1)).toBeUndefined();
    expect(record({ a: 1 })).toEqual({ a: 1 });
    expect(record(null)).toEqual({});
    expect(record('s')).toEqual({});
  });
});
