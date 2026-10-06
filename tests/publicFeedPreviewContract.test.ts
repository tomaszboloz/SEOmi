import { expect, it } from 'vitest';
import { handleBrowserFallback } from '@/services/tauri/browserFallback';
import i18n from '@/i18n';

it('reports the native feed command as desktop-only without exposing its arguments', async () => {
  const error = await handleBrowserFallback('fetch_public_feed', { keyword: 'private query' }).catch(value => value);
  expect(error).toBeInstanceOf(Error);
  if (!(error instanceof Error)) throw new Error('Expected a browser capability error');
  expect(error.message).toBe(i18n.t('runtimeErrors.tauri.desktopOnly'));
  expect(error.message).not.toContain('private query');
  expect(error.message).not.toContain('fetch_public_feed');
});
