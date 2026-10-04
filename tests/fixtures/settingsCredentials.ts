import { vi } from 'vitest';
import { createSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

const secureMocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), invoke: vi.fn() }));
vi.mock('@/services/tauri', () => ({ getSecureValue: secureMocks.get, setSecureValue: secureMocks.set, invokeTauriCommand: secureMocks.invoke }));

export function credentialsFixture() {
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', 'one');
  useProjectStore.setState({ activeProjectId: 'one' });
  secureMocks.get.mockReset().mockResolvedValue('');
  secureMocks.set.mockReset().mockResolvedValue(undefined);
  secureMocks.invoke.mockReset().mockResolvedValue(undefined);
  const store = createSettingsStore();
  return { store, ...secureMocks };
}
export function selectCredentialProject(project: string) {
  localStorage.setItem('seomi_active_project_v1', project);
  useProjectStore.setState({ activeProjectId: project || null });
}
