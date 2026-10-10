import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import process from 'node:process';
import test from 'node:test';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';

const apiScript = new URL('../dist/api.js', import.meta.url);

const run = (env) => {
  const child = spawn(process.execPath, [fileURLToPath(apiScript)], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const result = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ child, code, signal, stdout, stderr }));
  });
  result.child = child;
  return result;
};

const waitForReady = (child) => new Promise((resolve, reject) => {
  let output = '';
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error('Timed out waiting for local API startup.'));
  }, 5_000);
  timer.unref?.();
  const cleanup = () => {
    clearTimeout(timer);
    child.stdout.off('data', onData);
    child.off('close', onClose);
    child.off('error', onError);
  };
  const onData = (chunk) => {
    output += chunk;
    const line = output.split('\n').find((value) => value.trim());
    if (!line) return;
    cleanup();
    try { resolve(JSON.parse(line)); } catch (error) { reject(error); }
  };
  const onClose = (code, signal) => {
    cleanup();
    reject(new Error(`API exited before startup (${code ?? 'null'}/${signal ?? 'none'}).`));
  };
  const onError = (error) => { cleanup(); reject(error); };
  child.stdout.on('data', onData);
  child.once('close', onClose);
  child.once('error', onError);
});

const waitForResult = (result, timeoutMs = 5_000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => resolve(undefined), timeoutMs);
  timer.unref?.();
  result.then((value) => { clearTimeout(timer); resolve(value); }, (error) => {
    clearTimeout(timer);
    reject(error);
  });
});

const stop = async (result) => {
  const child = result.child;
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  let exited = await waitForResult(result);
  if (!exited) {
    child.kill('SIGKILL');
    exited = await waitForResult(result, 1_000);
  }
  return exited;
};

const runToExit = async (env) => {
  const result = run(env);
  try {
    return await waitForResult(result);
  } finally {
    if (result.child.exitCode === null && result.child.signalCode === null) await stop(result).catch(() => undefined);
  }
};

test('API process starts on an ephemeral port and shuts down on SIGTERM', async () => {
  const result = run({ SEOMI_LOCAL_API_TOKEN: 'api-process-contract-token', SEOMI_LOCAL_API_PORT: '0' });
  try {
    const info = await waitForReady(result.child);
    assert.equal(info.ok, true);
    assert.match(info.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const health = await globalThis.fetch(`${info.url}${info.health}`, {
      headers: { authorization: 'Bearer api-process-contract-token', connection: 'close' },
    });
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'seomi-local-api', host: '127.0.0.1' });
    const exited = await stop(result);
    assert.ok(exited, 'API process did not exit after shutdown request');
    if (process.platform === 'win32') assert.ok(exited.code === 0 || exited.signal === 'SIGTERM');
    else { assert.equal(exited.code, 0); assert.equal(exited.signal, null); }
  } finally {
    await stop(result);
  }
});

test('API process reports missing credentials and startup errors', async () => {
  const missing = await runToExit({ SEOMI_LOCAL_API_TOKEN: '', SEOMI_LOCAL_API_PORT: '' });
  assert.ok(missing, 'missing-token process did not exit');
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /SEOMI_LOCAL_API_TOKEN/);

  const invalidPort = await runToExit({ SEOMI_LOCAL_API_TOKEN: 'api-process-contract-token', SEOMI_LOCAL_API_PORT: '65536' });
  assert.ok(invalidPort, 'invalid-port process did not exit');
  assert.equal(invalidPort.code, 1);
  assert.match(invalidPort.stderr, /port/i);
});
