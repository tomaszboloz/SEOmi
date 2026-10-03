import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { authorized, json, LocalApiError, LOCAL_API_MAX_BODY_BYTES, readBody, validateOptions } from '../dist/localApiHttp.js';

const request = (chunks, headers = {}) => Object.assign(Readable.from(chunks), { headers });
const isStatus = (status) => (error) => error instanceof LocalApiError && error.statusCode === status;

test('public body reader handles split UTF-8, string chunks and empty streams', async () => {
  const bytes = Buffer.from('{"text":"żółć"}');
  assert.deepEqual(await readBody(request([bytes.subarray(0, 10), bytes.subarray(10)])), { text: 'żółć' });
  assert.deepEqual(await readBody(request(['{"ok":', 'true}'])), { ok: true });
  assert.deepEqual(await readBody(request([])), {});
  await assert.rejects(readBody(request(['{broken'])), isStatus(400));
  const error = new LocalApiError('local diagnostic', 413);
  assert.ok(error instanceof Error); assert.equal(error.message, 'local diagnostic');
  assert.equal(error.statusCode, 413);
});

test('body limits apply to actual bytes at the exact boundary despite absent or false content-length', async () => {
  const exact = `"${'x'.repeat(LOCAL_API_MAX_BODY_BYTES - 2)}"`;
  assert.equal((await readBody(request([exact]))).length, LOCAL_API_MAX_BODY_BYTES - 2);
  for (const headers of [{}, { 'content-length': '1' }, { 'content-length': 'Infinity' }]) {
    await assert.rejects(readBody(request([Buffer.alloc(LOCAL_API_MAX_BODY_BYTES), Buffer.from('x')], headers)), isStatus(413));
  }
  let consumed = false;
  const declared = { headers: { 'content-length': String(LOCAL_API_MAX_BODY_BYTES + 1) },
    async *[Symbol.asyncIterator]() { consumed = true; yield Buffer.from('unused'); } };
  await assert.rejects(readBody(declared), isStatus(413));
  assert.equal(consumed, false);
});

test('public authorization requires the exact bearer token bytes and prefix', () => {
  const token = 'fixture-local-token-123';
  assert.equal(authorized({ headers: { authorization: `Bearer ${token}` } }, token), true);
  for (const header of [undefined, '', `bearer ${token}`, `Basic ${token}`, `Bearer ${token}x`, 'Bearer fixture-local-token-124']) {
    assert.equal(authorized({ headers: { authorization: header } }, token), false);
  }
});

test('public response writer emits UTF-8 length and non-cacheable JSON with supplied status', () => {
  const headers = new Map(); let body;
  const response = { statusCode: 0, setHeader: (key, value) => headers.set(key, value), end: (value) => { body = value; } };
  json(response, 202, { message: 'żółć', count: 2 });
  assert.equal(response.statusCode, 202);
  assert.equal(headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(headers.get('content-length'), Buffer.byteLength(body));
  assert.deepEqual(JSON.parse(body), { message: 'żółć', count: 2 });
});

test('public local-server configuration validates token, concurrency and port boundaries', () => {
  const token = 'fixture-token-123456';
  assert.doesNotThrow(() => validateOptions({ token }));
  for (const port of [0, 65535]) for (const maxConcurrentRequests of [1, 16]) {
    assert.doesNotThrow(() => validateOptions({ token, port, maxConcurrentRequests }));
  }
  for (const value of ['', ' '.repeat(16), 'short']) assert.throws(() => validateOptions({ token: value }), /token/);
  for (const maxConcurrentRequests of [0, 17, 1.5, '4', NaN]) assert.throws(() => validateOptions({ token, maxConcurrentRequests }), /concurrency/);
  for (const port of [-1, 65536, 0.5, '80', NaN]) assert.throws(() => validateOptions({ token, port }), /port/);
});
