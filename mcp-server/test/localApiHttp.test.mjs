import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { authorized, json, readBody } from '../dist/localApiHttp.js';
import { LOCAL_API_MAX_BODY_BYTES, LocalApiError } from '../dist/localApiTypes.js';

const request = (chunks, headers = {}) => Object.assign(Readable.from(chunks), { headers });

test('json writes a non-cacheable UTF-8 body with an exact byte length', () => {
  const headers = {}; let ended;
  const response = { setHeader: (name, value) => { headers[name] = value; }, end: (body) => { ended = body; } };
  json(response, 201, { label: 'zażółć' });
  assert.equal(response.statusCode, 201);
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['content-length'], Buffer.byteLength(ended));
  assert.deepEqual(JSON.parse(ended), { label: 'zażółć' });
});

test('readBody parses JSON, treats an empty body as an object and rejects invalid JSON', async () => {
  assert.deepEqual(await readBody(request([Buffer.from('{"url":"https://a.test"}')])), { url: 'https://a.test' });
  assert.deepEqual(await readBody(request([])), {});
  await assert.rejects(readBody(request([Buffer.from('{')])), (error) => error instanceof LocalApiError && error.statusCode === 400);
});

test('readBody enforces the limit from the declared length and from streamed bytes', async () => {
  const declared = request([], { 'content-length': String(LOCAL_API_MAX_BODY_BYTES + 1) });
  await assert.rejects(readBody(declared), (error) => error.statusCode === 413);
  const streamed = request([Buffer.alloc(LOCAL_API_MAX_BODY_BYTES), Buffer.from('x')]);
  await assert.rejects(readBody(streamed), (error) => error.statusCode === 413);
});

test('authorized accepts only the exact bearer token', () => {
  const token = 'a'.repeat(32);
  assert.equal(authorized({ headers: { authorization: `Bearer ${token}` } }, token), true);
  assert.equal(authorized({ headers: { authorization: `Bearer ${token}x` } }, token), false);
  assert.equal(authorized({ headers: { authorization: token } }, token), false);
  assert.equal(authorized({ headers: {} }, token), false);
});
