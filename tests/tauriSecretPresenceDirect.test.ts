import { expect, it, vi } from 'vitest';
import { hasSecureValue, isStoredSecretMarker, STORED_SECRET_MARKER } from '@/services/tauri/secrets';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: invoke }));

it('checks presence through native IPC without returning the stored value', async () => {
  invoke.mockResolvedValue(true);
  await expect(hasSecureValue('openai_api_key')).resolves.toBe(true);
  expect(invoke).toHaveBeenCalledWith('has_secret', { name: 'openai_api_key' });
  expect(isStoredSecretMarker(STORED_SECRET_MARKER)).toBe(true);
  expect(isStoredSecretMarker('actual-secret')).toBe(false);
});
