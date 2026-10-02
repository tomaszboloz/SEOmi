import { describe, expect, it, vi } from 'vitest';
import { readTopicalMap, writeTopicalMap, topicalMapStorageKey } from '@/services/topicalDocument/storage';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { storage } from './fixtures/topicalMapContracts';
import * as persistent from '@/services/storage';

vi.mock('@/services/storage', () => ({ readStorage: vi.fn(), writeStorage: vi.fn() }));

describe('topical persistence contracts', () => {
  it('isolates project keys and returns empty data on invalid or unavailable storage', () => {
    expect(topicalMapStorageKey('p')).toBe('seomi_project_p_topical_map_v1');
    const local = storage();
    expect(readTopicalMap('p', local).nodes).toEqual([]);
    local.setItem(topicalMapStorageKey('p'), '{');
    expect(readTopicalMap('p', local).nodes).toEqual([]);
    expect(readTopicalMap('p', { getItem: () => { throw Error('unavailable'); }, setItem: () => {} }).nodes).toEqual([]);
  });
  it('persists normalized documents and surfaces browser write failures', () => {
    vi.mocked(persistent.readStorage).mockReturnValue(JSON.stringify({ entity: { name: 'saved' } }));
    expect(readTopicalMap('p').entity.name).toBe('saved');
    vi.mocked(persistent.writeStorage).mockReturnValue(true);
    const result = writeTopicalMap('p', createEmptyTopicalMap());
    expect(persistent.writeStorage).toHaveBeenCalledWith(topicalMapStorageKey('p'), JSON.stringify(result));
    vi.mocked(persistent.writeStorage).mockReturnValue(false);
    expect(() => writeTopicalMap('p', createEmptyTopicalMap())).toThrow();
  });
});
