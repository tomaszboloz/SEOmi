import { renderHook } from '@testing-library/react';
import { FolderPlus } from 'lucide-react';
import { expect, it, vi } from 'vitest';
import { useCommandPaletteItems } from '@/components/Layout/commandPalette/useCommandPaletteItems';

vi.mock('@/components/Layout/navigation', () => ({ WORKSPACE_NAVIGATION: [] }));

it('falls back to the folder icon when the navigation lacks workspace tool entries', () => {
  const { items } = renderHook(() => useCommandPaletteItems({
    query: '', activeProjectId: null, projects: [], selectProject: vi.fn(), setActiveTab: vi.fn(), openModal: vi.fn(), run: vi.fn(), t: ((k: string) => k) as never,
  })).result.current;
  expect(items.map((i) => i.id)).toEqual(['new-project', 'history', 'settings', 'ai-assistant', 'ai-connection']);
  expect(items.every((i) => i.icon === FolderPlus)).toBe(true);
});
