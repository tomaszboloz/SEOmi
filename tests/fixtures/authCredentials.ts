import { vi } from 'vitest';
import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { createAuthCredentials } from '@/stores/auth/credentials';
import { apiKeySaveQueues } from '@/stores/auth/runtime';
import type { AuthState } from '@/stores/auth/types';

const secure = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), invoke: vi.fn() }));
vi.mock('@/services/tauri', () => ({ getSecureValue: secure.get, setSecureValue: secure.set, invokeTauriCommand: secure.invoke }));
export function authCredentialsFixture() {
  apiKeySaveQueues.clear();
  secure.get.mockReset().mockResolvedValue('');
  secure.set.mockReset().mockResolvedValue(undefined);
  secure.invoke.mockReset();
  const store = create<AuthState>((set, get) => ({ ...useAuthStore.getInitialState(), ...createAuthCredentials(set, get) }));
  return { store, ...secure };
}
