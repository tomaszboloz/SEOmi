import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DragEvent } from 'react';
import i18n from '@/i18n';
import { useTopicalNodeMutations } from '@/components/Charts/semanticTopical/session/useTopicalNodeMutations';
import { createEmptyTopicalMap, createTopicalNode } from '@/services/topicalMap';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';

const mocks = vi.hoisted(() => ({ assess: vi.fn() }));
vi.mock('@/services/contentBrief', () => ({ assessContentBrief: mocks.assess }));

const t = i18n.t.bind(i18n) as never;
const node = (id: string, patch: Partial<TopicalNode> = {}): TopicalNode => ({ ...createTopicalNode(id), id, parentId: null, ...patch });
const setup = (nodes: TopicalNode[]) => {
  const documentRef = { current: { ...createEmptyTopicalMap(), nodes } as TopicalMapDocument };
  const persist = vi.fn((next: TopicalMapDocument) => { documentRef.current = next; });
  const setSelectedId = vi.fn();
  const updateWorkspacePreferences = vi.fn();
  const hook = renderHook(() => useTopicalNodeMutations({ documentRef, pages: [], t, persist, setSelectedId, updateWorkspacePreferences }));
  return { documentRef, persist, setSelectedId, updateWorkspacePreferences, ...hook };
};
const drop = (data: string) => ({ preventDefault: vi.fn(), dataTransfer: { getData: () => data } }) as unknown as DragEvent<HTMLElement>;
beforeEach(async () => { await i18n.changeLanguage('en'); mocks.assess.mockReset().mockReturnValue({ readyToAdvance: true, readyForBrief: true }); });

it('moves a node under a parent, then to the root, with notices', () => {
  const s = setup([node('a', { title: 'Alpha' }), node('b', { title: 'Beta' })]);
  act(() => s.result.current.moveTopicalNode('a', 'b'));
  expect(s.documentRef.current.nodes.find((n) => n.id === 'a')?.parentId).toBe('b');
  expect(s.result.current.hierarchyNotice).toBe(t('semanticWorkspace.assignedToParent', { node: 'Alpha', parent: 'Beta' }));
  act(() => s.result.current.moveTopicalNode('a', null));
  expect(s.result.current.hierarchyNotice).toBe(t('semanticWorkspace.assignedToRoot', { node: 'Alpha' }));
});

it('ignores unknown nodes and unchanged parents, and blocks cycles', () => {
  const s = setup([node('a'), node('b', { parentId: 'a' })]);
  act(() => s.result.current.moveTopicalNode('zzz', null));
  act(() => s.result.current.moveTopicalNode('a', null));
  expect(s.persist).not.toHaveBeenCalled();
  act(() => s.result.current.moveTopicalNode('a', 'b'));
  expect(s.persist).not.toHaveBeenCalled();
  expect(s.result.current.hierarchyNotice).toBe(t('semanticWorkspace.cannotCreateCycle'));
});

it('drops using dataTransfer or the dragging id, and ignores empty drops', () => {
  const s = setup([node('a'), node('b')]);
  const e = drop('a');
  act(() => s.result.current.dropTopicOn('b')(e));
  expect(e.preventDefault).toHaveBeenCalled();
  expect(s.documentRef.current.nodes[0].parentId).toBe('b');
  act(() => s.result.current.setDraggingNodeId('b'));
  act(() => s.result.current.dropTopicOn(null)(drop('')));
  expect(s.result.current.draggingNodeId).toBeNull();
  const calls = s.persist.mock.calls.length;
  act(() => s.result.current.dropTopicOn('b')(drop('')));
  expect(s.persist.mock.calls.length).toBe(calls);
});

it('adds nodes, optionally scheduled, and selects them', () => {
  const s = setup([node('a')]);
  act(() => s.result.current.addNode());
  expect(s.documentRef.current.nodes).toHaveLength(2);
  expect(s.setSelectedId).toHaveBeenLastCalledWith(s.documentRef.current.nodes[1].id);
  act(() => s.result.current.addNodeOnDate('2026-11-02'));
  expect(s.documentRef.current.nodes[2].scheduledDate).toBe('2026-11-02');
  expect(s.updateWorkspacePreferences).toHaveBeenCalledWith({ view: 'topics' });
});

it.each([
  ['drafted', { readyToAdvance: false, readyForBrief: true }, 'briefed'],
  ['drafted', { readyToAdvance: false, readyForBrief: false }, 'planned'],
  ['briefed', { readyToAdvance: true, readyForBrief: false }, 'planned'],
  ['drafted', { readyToAdvance: true, readyForBrief: true }, 'drafted'],
])('updateNode demotes %s with %j to %s', (lifecycle, assessment, expected) => {
  mocks.assess.mockReturnValue(assessment);
  const s = setup([node('a', { lifecycle: lifecycle as never }), node('b', { lifecycle: 'drafted' })]);
  act(() => s.result.current.updateNode('a', { title: 'New' }));
  const [a, b] = s.documentRef.current.nodes;
  expect(a.title).toBe('New');
  expect(a.lifecycle).toBe(expected);
  expect(b.lifecycle).toBe('drafted');
});

it('updateEntity re-evaluates every node lifecycle', () => {
  mocks.assess.mockReturnValue({ readyToAdvance: false, readyForBrief: false });
  const s = setup([node('a', { lifecycle: 'drafted' }), node('b', { lifecycle: 'briefed' }), node('c', { lifecycle: 'planned' })]);
  act(() => s.result.current.updateEntity({ name: 'Acme' } as never));
  expect(s.documentRef.current.entity).toMatchObject({ name: 'Acme' });
  expect(s.documentRef.current.nodes.map((n) => n.lifecycle)).toEqual(['briefed', 'planned', 'planned']);
  mocks.assess.mockReturnValue({ readyToAdvance: true, readyForBrief: true });
  act(() => s.result.current.updateEntity({}));
  expect(s.documentRef.current.nodes.map((n) => n.lifecycle)).toEqual(['briefed', 'planned', 'planned']);
});
