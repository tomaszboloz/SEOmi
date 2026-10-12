import { afterEach, beforeEach, expect, it } from 'vitest';
import { credentialsFixture } from './fixtures/settingsCredentials';

const marker = '__seomi_secret_present__';

beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
});
afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

it('stores presence markers for nonempty native DataForSEO and Google credentials', async () => {
  const f = credentialsFixture();
  await f.store.getState().saveDataForSeoCredentials({ login: 'login', password: 'password' });
  expect(f.store.getState().dataForSeoCredentials).toEqual({ login: marker, password: marker });
  await f.store.getState().saveGoogleMetricsApiKey('google-key');
  expect(f.store.getState().googleMetricsApiKey).toBe(marker);
});

it('keeps an empty native Google key empty when there is no stored marker', async () => {
  const f = credentialsFixture();
  await f.store.getState().saveGoogleMetricsApiKey('   ');
  expect(f.store.getState().googleMetricsApiKey).toBe('');
});
