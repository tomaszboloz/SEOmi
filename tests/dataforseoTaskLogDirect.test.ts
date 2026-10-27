import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeProjectForTaskLog,
  appendDataForSeoTask,
  clearDataForSeoTaskLog,
  readDataForSeoTaskLog,
} from '@/services/dataforseo/dataforseoTaskLog';
import * as storage from '@/services/storage';

describe('dataforseoTaskLog defensive contracts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles activeProjectForTaskLog error gracefully', () => {
    vi.spyOn(storage, 'readStorage').mockImplementation(() => {
      throw new Error('storage error');
    });
    expect(activeProjectForTaskLog()).toBeNull();
  });

  it('returns empty array when projectId is empty or null', () => {
    expect(readDataForSeoTaskLog(null)).toEqual([]);
    expect(readDataForSeoTaskLog('')).toEqual([]);
  });

  it('returns empty array when stored JSON is not an array or malformed', () => {
    vi.spyOn(storage, 'readStorage').mockReturnValue('{"not": "an array"}');
    expect(readDataForSeoTaskLog('proj-1')).toEqual([]);

    vi.spyOn(storage, 'readStorage').mockReturnValue('invalid-json');
    expect(readDataForSeoTaskLog('proj-1')).toEqual([]);
  });

  it('handles clearDataForSeoTaskLog with null projectId and storage error', () => {
    expect(() => clearDataForSeoTaskLog(null)).not.toThrow();
    vi.spyOn(storage, 'removeStorage').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(() => clearDataForSeoTaskLog('proj-1')).not.toThrow();
  });

  it('appends task, writes storage and dispatches event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const task = appendDataForSeoTask({
      endpoint: '/v3/serp',
      taskId: null,
      statusCode: 20000,
      statusMessage: 'Ok',
      cost: 0.002,
      timeSeconds: 0.1,
      resultCount: 1,
      requestedAt: '2026-10-06T12:00:00Z',
      completedAt: '2026-10-06T12:00:01Z',
    }, 'proj-1');

    expect(task?.ok).toBe(true);
    expect(dispatchSpy).toHaveBeenCalled();
    const stored = readDataForSeoTaskLog('proj-1');
    expect(stored).toHaveLength(1);
    expect(stored[0].endpoint).toBe('/v3/serp');
  });
});
