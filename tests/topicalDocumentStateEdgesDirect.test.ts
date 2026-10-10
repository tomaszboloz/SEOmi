import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTopicalDocumentState } from '@/components/Charts/semanticTopical/session/useTopicalDocumentState';
import type { TopicalMapDocument } from '@/services/topicalMap';
import type { TopicalSessionDependencies } from '@/components/Charts/semanticTopical/session/topicalSessionTypes';

const emptyDocument = (name = ''): TopicalMapDocument => ({
  schemaVersion: 1, entity: { name, description: '', facts: [] }, nodes: [], updatedAt: '2026-01-01',
});
const preferences = { view: 'topics', month: '2026-01', search: '', schemaUrl: '', includeSchemaOrganization: true, includeSchemaBreadcrumbs: false, schemaArticleType: '', filters: { lifecycle: 'all', kind: 'all', boundary: 'all' } };

describe('topical document state project transitions', () => {
  it('reloads maps and preferences on project changes and resets to an empty document', () => {
    const readMap = vi.fn((id: string) => emptyDocument(id));
    const readPreferences = vi.fn(() => preferences);
    const writeMap = vi.fn((_: string, value: TopicalMapDocument) => value);
    const dependencies = { readMap, readPreferences, writeMap, writePreferences: vi.fn(() => true) } as unknown as TopicalSessionDependencies;
    const { result, rerender } = renderHook(({ projectId }) => useTopicalDocumentState({ projectId, dependencies }), { initialProps: { projectId: 'one' as string | null } });

    act(() => result.current.setSelectedId('stale-node'));
    rerender({ projectId: 'two' });
    expect(result.current.document.entity.name).toBe('two');
    expect(result.current.selectedId).toBeNull();
    expect(readMap).toHaveBeenCalledWith('two');
    expect(readPreferences).toHaveBeenCalledWith('two');

    rerender({ projectId: null });
    expect(result.current.document.entity.name).toBe('');
    act(() => result.current.persist(emptyDocument('draft')));
    expect(writeMap).not.toHaveBeenCalled();
  });

  it('initializes without a project and reports persistence failures', () => {
    const readMap = vi.fn(() => emptyDocument('unexpected'));
    const dependencies = {
      readMap, readPreferences: vi.fn(() => preferences), writeMap: vi.fn(() => { throw new Error('write failed'); }),
      writePreferences: vi.fn(() => true),
    } as unknown as TopicalSessionDependencies;
    const { result } = renderHook(() => useTopicalDocumentState({ projectId: null, dependencies }));

    expect(readMap).not.toHaveBeenCalled();
    act(() => result.current.persist(emptyDocument('draft')));
    expect(result.current.saveError).toBe(false);
    const projectView = renderHook(() => useTopicalDocumentState({ projectId: 'one', dependencies }));
    act(() => projectView.result.current.persist(emptyDocument('draft')));
    expect(projectView.result.current.saveError).toBe(true);
  });
});
