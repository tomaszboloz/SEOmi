import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import test, { afterEach, mock } from 'node:test';

const fixtures = [];
const headersOf = (headers) => Object.entries(headers).flatMap(([key, value]) => [key, String(value)]);
const requestFixture = (_url, _options, callback) => {
  const request = new EventEmitter();
  request.end = () => {
    const fixture = fixtures.shift();
    if (!fixture) throw new Error('Missing controlled HTTP fixture.');
    if (fixture.error) {
      globalThis.queueMicrotask(() => request.emit('error', fixture.error));
      return;
    }
    const incoming = Readable.from(fixture.body === undefined ? [] : [Buffer.from(fixture.body)]);
    Object.assign(incoming, {
      rawHeaders: headersOf(fixture.headers || {}),
      statusCode: fixture.status || 200,
      statusMessage: fixture.statusMessage || 'Fixture response',
    });
    callback(incoming);
  };
  return request;
};
mock.method(http, 'request', requestFixture);
mock.method(https, 'request', requestFixture);
syncBuiltinESMExports();
const { auditPublicUrl } = await import('../dist/auditRunner.js');

afterEach(() => assert.equal(fixtures.length, 0));
const response = (status, headers = {}, body) => fixtures.push({ status, headers, body });

test('audits a redirected HTML response through the controlled HTTPS transport', async () => {
  response(302, { location: 'https://1.1.1.1/final' });
  response(200, {
    'content-type': 'text/html; charset=utf-8',
    'strict-transport-security': 'max-age=31536000',
    'x-content-type-options': 'nosniff',
  }, '<title>Audit fixture</title><meta name="description" content="Useful description">'
    + '<meta name="robots" content="index,follow"><meta property="og:title" content="OG fixture">'
    + '<link rel="canonical" href="https://1.1.1.1/final"><main><h1>SEO audit</h1><h2>Signals</h2>'
    + '<p>semantic audit signals semantic quality</p><a href="/next#fragment">Next</a></main>');
  const result = await auditPublicUrl('https://1.1.1.1/start', 2_000, { scopeHost: '1.1.1.1' });
  assert.equal(result.status, 200);
  assert.equal(result.final_url, 'https://1.1.1.1/final');
  assert.deepEqual(result.redirects, ['https://1.1.1.1/start']);
  assert.equal(result.title, 'Audit fixture');
  assert.equal(result.meta_description, 'Useful description');
  assert.equal(result.canonical, 'https://1.1.1.1/final');
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.open_graph['og:title'], 'OG fixture');
  assert.deepEqual(result.headings, { h1: ['SEO audit'], h2: ['Signals'], h3: [], h4: [], h5: [], h6: [] });
  assert.equal(result.security_headers['strict-transport-security'], 'max-age=31536000');
  assert.equal(result.discovered_links[0], 'https://1.1.1.1/next');
  assert.equal(result.semantic_content_source, 'primary-root');
  assert.ok(result.semantic_terms.includes('semantic'));
});

test('rejects an advertised body above the audit limit and marks non-HTML semantic data unavailable', async () => {
  response(200, { 'content-length': String(5 * 1024 * 1024 + 1) });
  await assert.rejects(auditPublicUrl('http://1.1.1.1/too-large', 2_000), /exceeds 5242880 bytes/);
  response(200, { 'content-type': 'application/json' }, '{"status":"fixture"}');
  const result = await auditPublicUrl('http://1.1.1.1/data', 2_000);
  assert.equal(result.response_body_truncated, false);
  assert.equal(result.title, null);
  assert.deepEqual(result.semantic_terms, []);
  assert.deepEqual(result.semantic_links, []);
  assert.equal(result.semantic_content_source, 'unavailable');
});

test('propagates a controlled transport failure without making another request', async () => {
  const failure = new Error('fixture transport failure');
  fixtures.push({ error: failure });
  await assert.rejects(auditPublicUrl('http://1.1.1.1/error', 2_000), (error) => error === failure);
});

test('stops after six redirects', async () => {
  for (let step = 1; step <= 6; step += 1) response(302, { location: `http://1.1.1.1/r${step}` });
  await assert.rejects(auditPublicUrl('http://1.1.1.1/start', 2_000), /Redirect limit exceeded/);
});

test('does not treat a redirect without Location as a redirect', async () => {
  response(302);
  const result = await auditPublicUrl('http://1.1.1.1/no-location', 2_000);
  assert.equal(result.status, 302);
  assert.deepEqual(result.redirects, []);
  assert.equal(result.final_url, 'http://1.1.1.1/no-location');
  assert.equal(result.semantic_content_source, 'unavailable');
});

test('handles a body-less redirect and rejects a redirect outside the requested scope', async () => {
  response(304, { location: 'https://1.1.1.1/final' });
  response(200, { 'content-type': 'text/html' }, '<title>Final</title>');
  const result = await auditPublicUrl('https://1.1.1.1/start', 2_000, { scopeHost: '1.1.1.1' });
  assert.equal(result.title, 'Final');
  response(302, { location: 'https://8.8.8.8/outside' });
  await assert.rejects(
    auditPublicUrl('https://1.1.1.1/start', 2_000, { scopeHost: '1.1.1.1' }),
    /outside the requested scope host/,
  );
});

test('marks an HTML stream truncated when the byte limit is reached without Content-Length', async () => {
  response(200, { 'content-type': 'text/html' }, 'x'.repeat(5 * 1024 * 1024 + 1));
  const result = await auditPublicUrl('http://1.1.1.1/stream-too-large', 2_000);
  assert.equal(result.response_body_truncated, true);
  assert.equal(result.semantic_content_source, 'unavailable');
});

test('returns a body-less 204 as the final response', async () => {
  response(204);
  const result = await auditPublicUrl('http://1.1.1.1/no-content', 2_000);
  assert.equal(result.status, 204);
  assert.equal(result.response_body_truncated, false);
  assert.deepEqual(result.redirects, []);
  assert.equal(result.semantic_content_source, 'unavailable');
});

test('does not follow Location on an error status', async () => {
  response(404, { location: 'http://8.8.8.8/ignored', 'content-type': 'text/html' }, '<title>Missing</title>');
  const result = await auditPublicUrl('http://1.1.1.1/missing', 2_000);
  assert.equal(result.status, 404);
  assert.deepEqual(result.redirects, []);
  assert.equal(result.final_url, 'http://1.1.1.1/missing');
  assert.equal(result.title, 'Missing');
});

test('rejects unsafe or malformed redirect targets before the next request', async () => {
  response(302, { location: 'http://127.0.0.1/private' });
  await assert.rejects(auditPublicUrl('http://1.1.1.1/start', 2_000), /private|loopback/i);
  response(302, { location: 'http://[invalid' });
  await assert.rejects(auditPublicUrl('http://1.1.1.1/start', 2_000), /invalid URL/i);
});
