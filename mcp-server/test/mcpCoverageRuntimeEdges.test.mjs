import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const runChild = (source, env = {}, args = []) => {
  const result = spawnSync(process.execPath, [...args, '--input-type=module', '-e', source], {
    cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

test('HTTP safety exercises default DNS resolution and both lookup callback forms', () => {
  const output = runChild(`
    import { mock } from 'node:test';
    import dns from 'node:dns/promises';
    import http from 'node:http';
    import { Readable } from 'node:stream';
    import { syncBuiltinESMExports } from 'node:module';
    mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
    mock.method(http, 'request', (url, options, callback) => {
      options.lookup(url.hostname, {}, () => {});
      const incoming = Readable.from([]);
      incoming.rawHeaders = ['x-fixture', 'yes'];
      incoming.statusMessage = 'fixture';
      callback(incoming);
      return { once() { return this; }, end() {} };
    });
    syncBuiltinESMExports();
    const safety = await import('./mcp-server/dist/httpSafety.js?runtime-edge');
    const target = await safety.validatePublicTarget('https://default.example/');
    const response = await safety.requestPinnedPublicTarget({
      url: new URL('http://fixture.example/'), address: '8.8.8.8', family: 4,
    }, 1000);
    console.log(JSON.stringify({ address: target.address, status: response.status, body: await response.text() }));
  `);
  assert.deepEqual(JSON.parse(output), { address: '8.8.8.8', status: 502, body: '' });
});

test('IP safety rejects malformed values after a family-positive resolver', () => {
  const output = runChild(`
    import { mock } from 'node:test';
    import net from 'node:net';
    import { syncBuiltinESMExports } from 'node:module';
    const nativeIsIP = net.isIP.bind(net);
    mock.method(net, 'isIP', (value) => value === 'fake-ipv4' ? 4 : value === 'fake-ipv6' ? 6 : nativeIsIP(value));
    syncBuiltinESMExports();
    const safety = await import('./mcp-server/dist/ipSafety.js?ip-edge');
    console.log(JSON.stringify({ ipv4: safety.parseIpv4('fake-ipv4'), ipv6: safety.isPublicAddress('fake-ipv6') }));
  `);
  assert.deepEqual(JSON.parse(output), { ipv4: null, ipv6: false });
});

const loader = `data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('localApi.js')) {
      const source = 'export const startLocalApi=async()=>{throw "api-string-error"};';
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    }
    if (!specifier.endsWith('auditWorkflow.js')) return nextResolve(specifier, context);
    const mode = process.env.SEOMI_COVERAGE_LOADER_MODE;
    const source = mode === 'cli-success'
      ? 'export const DEFAULT_AUDIT_TIMEOUT_MS=15000;export const validatePublicScopeOptions=()=>{};export const auditPublicUrl=async()=>({fixture:true});export const crawlPublicSite=async()=>({fixture:true});'
      : mode === 'cli-string'
        ? 'export const DEFAULT_AUDIT_TIMEOUT_MS=15000;export const validatePublicScopeOptions=()=>{};export const auditPublicUrl=async()=>{throw "fixture-string"};export const crawlPublicSite=async()=>({});'
        : 'export const DEFAULT_AUDIT_TIMEOUT_MS=15000;export const validatePublicScopeOptions=()=>{throw "fixture-scope"};export const auditPublicUrl=async()=>({});export const crawlPublicSite=async()=>({});';
    return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
  }
`)}`;

test('CLI covers successful output and non-Error rejection formatting', () => {
  const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
  const run = (mode) => spawnSync(process.execPath, [
    '--loader', loader, cli, 'audit', '--url', 'https://example.com/',
  ], { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, SEOMI_COVERAGE_LOADER_MODE: mode } });
  const success = run('cli-success');
  assert.equal(success.status, 0, success.stderr);
  assert.deepEqual(JSON.parse(success.stdout), { fixture: true });
  const failure = run('cli-string');
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /fixture-string/);
});

test('payload validation gives a stable error for a non-Error scope failure', () => {
  const output = runChild(`
    const { executeApiPayload } = await import('./mcp-server/dist/localApiPayload.js?payload-edge');
    try {
      await executeApiPayload({ url: 'https://example.com/', scope_path: '/docs' }, '/v1/audit', async () => ({}), async () => ({}));
    } catch (error) {
      console.log(JSON.stringify({ message: error.message, status: error.statusCode }));
    }
  `, { SEOMI_COVERAGE_LOADER_MODE: 'payload-string' }, ['--loader', loader]);
  assert.deepEqual(JSON.parse(output), { message: 'Invalid scope options.', status: 400 });
});

test('API defaults to an ephemeral port when the port variable is absent', async () => {
  const env = { ...process.env, SEOMI_LOCAL_API_TOKEN: 'mcp-api-default-port-token' };
  delete env.SEOMI_LOCAL_API_PORT;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/api.js', import.meta.url))], {
    cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let line = '';
  child.stdout.on('data', (chunk) => { line += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('API did not start')), 5000);
    child.stdout.on('data', () => { if (line.includes('\n')) { clearTimeout(timer); resolve(); } });
    child.once('error', reject);
  });
  assert.match(line, /"ok":true/);
  child.kill('SIGTERM');
  const [code] = await once(child, 'close');
  assert.equal(code, 0);
});

test('API evaluates its absent-port default before reporting a missing token', () => {
  const output = runChild(`
    delete process.env.SEOMI_LOCAL_API_PORT;
    process.env.SEOMI_LOCAL_API_TOKEN = '';
    const exit = process.exit;
    process.exit = (code) => { throw new Error('exit:' + code); };
    try { await import('./mcp-server/dist/api.js?missing-token'); } catch (error) { console.log(error.message); }
    process.exit = exit;
  `);
  assert.equal(output, 'exit:1');
});

test('API formats a non-Error startup failure without losing the original message', () => {
  const output = runChild(`
    process.env.SEOMI_LOCAL_API_TOKEN = 'mcp-api-string-error-token';
    const exit = process.exit;
    process.exit = (code) => { throw new Error('exit:' + code); };
    try { await import('./mcp-server/dist/api.js?string-error'); } catch (error) { console.log(error.message); }
    process.exit = exit;
  `, { SEOMI_COVERAGE_LOADER_MODE: 'api-string' }, ['--loader', loader]);
  assert.equal(output, 'exit:1');
});
