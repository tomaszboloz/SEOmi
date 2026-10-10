import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const cli = new URL('../dist/cli.js', import.meta.url);
const runCli = (...args) => spawnSync(process.execPath, [fileURLToPath(cli), ...args], { encoding: 'utf8' });

test('rejects missing command values before any transport request', () => {
  const missingUrl = runCli('audit');
  assert.equal(missingUrl.status, 1);
  assert.match(missingUrl.stderr, /audit requires --url/);
  const missingOption = runCli('audit', '--url', '--timeout-ms');
  assert.equal(missingOption.status, 1);
  assert.match(missingOption.stderr, /--url requires a value/);
  const missingRepeated = runCli('crawl', '--url', 'https://example.com', '--include', '--exclude');
  assert.equal(missingRepeated.status, 1);
  assert.match(missingRepeated.stderr, /--include requires a value/);
});

test('reaches the audit runner only with a private fixture target', () => {
  const result = runCli(
    'audit', '--url', 'http://127.0.0.1/private', '--scope-host', 'example.com', '--scope-path', '/docs',
    '--include', '/docs/*', '--exclude', '/docs/private/*', '--allow-subdomains',
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /private|loopback/i);
});

test('reaches the crawl runner with explicit and default bounds without network access', () => {
  for (const args of [
    ['crawl', '--url', 'http://127.0.0.1/private', '--max-pages', '100', '--max-depth', '0'],
    ['crawl', '--url', 'http://127.0.0.1/private'],
  ]) {
    const result = runCli(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /private|loopback/i);
  }
});

test('rejects every invalid crawl depth shape before validating the target', () => {
  for (const value of ['11', '-1', '1.5']) {
    const result = runCli('crawl', '--url', 'https://example.com', '--max-depth', value);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /max-depth must be an integer between 0 and 10/);
  }
});
