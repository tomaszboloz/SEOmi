import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createEmptyTopicalMap, createTopicalNode } from '@/services/topicalMap';
import { buildSemanticMap } from '@/services/semanticMap';
import { useSemanticTopicalSession } from '@/components/Charts/semanticTopical/useSemanticTopicalSession';
import { defaultTopicalWorkspacePreferences, normalizeTopicalCandidateUrl, readTopicalWorkspacePreferences, topicalNodeDepth, topicalWorkspacePreferencesKey } from '@/components/Charts/semanticTopical/workspaceHelpers';
import { FactReuseToggle, Metric } from '@/components/Charts/semanticTopical/workspacePrimitives';

beforeEach(() => localStorage.clear());

it.each([['https://example.com/page#fragment', 'https://example.com/page'], ['ftp://example.com', null], ['invalid', null]])('normalizes candidate %s', (value, expected) => {
  expect(normalizeTopicalCandidateUrl(value)).toBe(expected);
});

it('rejects a coercible array month while retaining independently valid preferences', () => {
  localStorage.setItem(topicalWorkspacePreferencesKey('prefs'), JSON.stringify({ view: 'entity', month: ['2026-09'], search: 'term' }));
  expect(readTopicalWorkspacePreferences('prefs')).toMatchObject({ view: 'entity', month: defaultTopicalWorkspacePreferences().month, search: 'term' });
});

it.each([null, [], 42, { view: 'invalid', filters: { kind: 'invalid' }, schemaArticleType: false }])('recovers malformed preferences %j', (value) => {
  localStorage.setItem(topicalWorkspacePreferencesKey('prefs'), JSON.stringify(value));
  expect(readTopicalWorkspacePreferences('prefs')).toEqual(defaultTopicalWorkspacePreferences());
  expect(readTopicalWorkspacePreferences(null)).toEqual(defaultTopicalWorkspacePreferences());
});

it('bounds preference text and preserves supported filters, schema flags and an empty draft', () => {
  const value = { view: 'calendar', month: '2026-02', filters: { lifecycle: 'drafted', kind: 'cluster', boundary: 'outer' }, search: 'a'.repeat(300), schemaUrl: 'b'.repeat(3000), includeSchemaOrganization: false, includeSchemaBreadcrumbs: true, schemaArticleType: 'NewsArticle' };
  localStorage.setItem(topicalWorkspacePreferencesKey('prefs'), JSON.stringify(value));
  const parsed = readTopicalWorkspacePreferences('prefs');
  expect(parsed).toEqual({ ...value, search: 'a'.repeat(200), schemaUrl: 'b'.repeat(2048) });
});

it('bounds hierarchy depth for cycles and missing parents', () => {
  const parent = createTopicalNode('parent');
  const child = { ...createTopicalNode('child'), parentId: parent.id };
  expect(topicalNodeDepth(child, [parent, child])).toBe(1);
  expect(topicalNodeDepth(child, [child])).toBe(0);
  expect(topicalNodeDepth(child, [{ ...parent, parentId: child.id }, child])).toBe(1);
});

it('uses injectable persistence and recovers failed writes without losing the in-memory node', () => {
  const map = createEmptyTopicalMap();
  const writeMap = vi.fn(() => { throw new Error('write failed'); });
  const services = { readMap: vi.fn(() => map), writeMap, readPreferences: vi.fn(defaultTopicalWorkspacePreferences), writePreferences: vi.fn(() => true) };
  const { result } = renderHook(() => useSemanticTopicalSession({ projectId: 'injected', pages: [], graph: buildSemanticMap([], 'https://example.com'), runId: 'run' }, services));
  act(() => result.current.addNode());
  expect(services.readMap).toHaveBeenCalledWith('injected');
  expect(writeMap).toHaveBeenCalledWith('injected', expect.objectContaining({ nodes: expect.any(Array) }));
  expect(result.current.document.nodes).toHaveLength(1);
  expect(result.current.saveError).toBe(true);
});

it('renders metrics and changes only explicitly verified sourced facts', () => {
  const onChange = vi.fn();
  render(<><Metric label="Count" value={0} /><FactReuseToggle fact={{ id: 'fact', attribute: 'Attribute', value: 'Value', sourceUrl: 'https://example.com', reuseStatus: 'locked' }} onChange={onChange} /></>);
  expect(screen.getByText('0')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(onChange).toHaveBeenCalledWith('verified');
});
