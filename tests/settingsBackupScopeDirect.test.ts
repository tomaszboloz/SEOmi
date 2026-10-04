import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSettingsBackupScope } from '@/components/Settings/settings/useSettingsBackupScope';
import { useProjectStore } from '@/stores/projectStore';

afterEach(cleanup);
const fixture = () => {
  const select = vi.fn((activeProjectId: string) => useProjectStore.setState({ activeProjectId }));
  useProjectStore.setState({ activeProjectId: 'one', selectProject: select });
  const clear = vi.fn();
  const hook = renderHook(({ owner }) => useSettingsBackupScope(owner, clear), { initialProps: { owner: 'one' } });
  return { ...hook, select, clear };
};

it('rejects external selection immediately, invalidates return to the same project and accepts its own transition', () => {
  const f = fixture(); const old = f.result.current();
  expect(old.isCurrent()).toBe(true);
  useProjectStore.setState({ activeProjectId: 'two' });
  expect(old.isCurrent()).toBe(false);
  old.selectProject('forbidden'); expect(f.select).not.toHaveBeenCalled();
  f.rerender({ owner: 'two' }); expect(f.clear).toHaveBeenCalledExactlyOnceWith(null);
  useProjectStore.setState({ activeProjectId: 'one' }); f.rerender({ owner: 'one' });
  expect(old.isCurrent()).toBe(false);
  const latest = f.result.current(); old.selectProject('forbidden'); expect(f.select).not.toHaveBeenCalled();
  act(() => latest.selectProject('imported'));
  f.rerender({ owner: 'imported' });
  expect(latest.isCurrent()).toBe(true); expect(f.select).toHaveBeenCalledExactlyOnceWith('imported');
  expect(f.clear).toHaveBeenCalledTimes(2);
  f.unmount(); expect(latest.isCurrent()).toBe(false);
});

it('recovers expected ownership after a selection failure and supersedes old operations', () => {
  const f = fixture(); const old = f.result.current(); const current = f.result.current();
  expect(old.isCurrent()).toBe(false); old.selectProject('forbidden'); expect(f.select).not.toHaveBeenCalled();
  f.select.mockImplementationOnce(() => { throw new Error('selection failed'); });
  expect(() => current.selectProject('new')).toThrow('selection failed');
  expect(current.isCurrent()).toBe(true);
  expect(f.clear).not.toHaveBeenCalled();
  f.unmount(); expect(current.isCurrent()).toBe(false);
});
