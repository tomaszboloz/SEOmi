import assert from 'node:assert/strict';
import test from 'node:test';
import { handleBrowserFallback } from '../src/services/tauri/browserFallback.js';
import { invokeTauriCommand, isTauriEnvironment } from '../src/services/tauri/transport.js';

test('Tauri IPC environment detection and browser fallback error injection & boundary validation', async () => {
  assert.equal(typeof isTauriEnvironment(), 'boolean');

  const hasSecret = await handleBrowserFallback('has_secret', { key: 'test' });
  assert.equal(hasSecret, false);

  const getSecret = await handleBrowserFallback('get_secret', { key: 'test' });
  assert.equal(getSecret, null);

  const setSecret = await handleBrowserFallback('set_secret', { key: 'test', value: 'secret' });
  assert.equal(setSecret, undefined);

  const config = await handleBrowserFallback('get_config');
  assert.ok(config && typeof config === 'object');

  await assert.rejects(async () => {
    await handleBrowserFallback('inspect_url', { url: 'https://example.com' });
  });

  await assert.rejects(async () => {
    await handleBrowserFallback('check_for_updates');
  });

  const fallbackConfig = await invokeTauriCommand('get_config');
  assert.ok(fallbackConfig);
});
