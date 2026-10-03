import { expect, it } from 'vitest';

import { createTopicalNode, updateManualTopicalQueries } from '@/services/topicalMap';

it('replaces manual queries while preserving observed provider evidence and stable manual identifiers', () => {
  const imported = { id: 'observed', text: 'coffee impressions', provenance: 'gsc' as const };
  const retained = { id: 'manual-stable', text: 'Coffee guide', provenance: 'asserted' as const };
  const node = { ...createTopicalNode('Coffee'), queries: [imported, retained, { id: 'removed', text: 'Old draft', provenance: 'asserted' as const }] };
  const result = updateManualTopicalQueries(node, 'Coffee guide\nNew intent\nnew INTENT\n');
  expect(result.limitReached).toBe(false);
  expect(result.queries.map(query => query.text)).toEqual(['coffee impressions', 'Coffee guide', 'New intent']);
  expect(result.queries[0]).toBe(imported); expect(result.queries[1]).toBe(retained);
  expect(result.queries[2].provenance).toBe('asserted');
  expect(node.queries.map(query => query.id)).toEqual(['observed', 'manual-stable', 'removed']);
});

it('caps manual additions after observed queries without replacing their evidence', () => {
  const imported = Array.from({ length: 99 }, (_, index) => ({ id: `observed-${index}`, text: `actual query ${index}`, provenance: 'dataforseo' as const }));
  const result = updateManualTopicalQueries({ ...createTopicalNode('Coffee'), queries: imported }, 'New intent\nOther intent');
  expect(result.limitReached).toBe(true); expect(result.queries).toHaveLength(100);
  expect(result.queries.slice(0, 99)).toEqual(imported); expect(result.queries[99].text).toBe('New intent');
});

it('allows clearing manual queries without deleting observed queries', () => {
  const imported = { id: 'observed', text: 'actual query', provenance: 'gsc' as const };
  const result = updateManualTopicalQueries({ ...createTopicalNode('Coffee'), queries: [imported, {id:'manual',text:'draft',provenance:'asserted'}] }, '   ');
  expect(result).toEqual({queries:[imported],limitReached:false});
});
