import { describe, expect, it, vi } from 'vitest';
import { createSecureActions } from '@/stores/settings/secureActions';
import type { SettingsState } from '@/stores/settings/types';

const tick = () => new Promise((r) => setTimeout(r, 0));

const setup = (initialProject = 'p1') => {
  let project = initialProject;
  const state: Record<string, unknown> = {};
  const set = vi.fn((patch: unknown) => { Object.assign(state, patch as object); });
  const actions = createSecureActions(set as never, () => project);
  return { actions, state, set, switchTo: (id: string) => { project = id; } };
};

describe('saveSecure', () => {
  it('writes to the captured project and applies the result when still current', async () => {
    const { actions, state } = setup();
    const write = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    await actions.saveSecure('dfs', write, onSaved);
    expect(write).toHaveBeenCalledWith('p1');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(state).toMatchObject({ isSaving: false, secureStorageError: null });
  });

  it('does not apply the result after a project switch', async () => {
    const { actions, switchTo } = setup();
    let release!: () => void;
    const write = vi.fn(() => new Promise<void>((res) => { release = res; }));
    const onSaved = vi.fn();
    const pending = actions.saveSecure('dfs', write, onSaved);
    await tick();
    switchTo('p2');
    release();
    await pending;
    expect(write).toHaveBeenCalledWith('p1');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('reports Error messages, stringifies other failures and rethrows', async () => {
    const { actions, state } = setup();
    await expect(actions.saveSecure('k', () => Promise.reject(new Error('denied')), vi.fn())).rejects.toThrow('denied');
    expect(state.secureStorageError).toBe('denied');
    await expect(actions.saveSecure('k', () => Promise.reject('plain'), vi.fn())).rejects.toBe('plain');
    expect(state.secureStorageError).toBe('plain');
  });

  it('hides the error of a save that was superseded or switched away', async () => {
    const { actions, state, switchTo } = setup();
    let fail!: (e: Error) => void;
    const pending = actions.saveSecure('k', () => new Promise<void>((_, rej) => { fail = rej; }), vi.fn());
    await tick();
    switchTo('p2');
    fail(new Error('late'));
    await expect(pending).rejects.toThrow('late');
    expect(state.secureStorageError).toBeNull();
  });

  it('keeps isSaving true until every queued save finishes', async () => {
    const { actions, state } = setup();
    let release!: () => void;
    const slow = actions.saveSecure('k', () => new Promise<void>((res) => { release = res; }), vi.fn());
    const fast = actions.saveSecure('k', async () => undefined, vi.fn());
    await tick();
    expect(state.isSaving).toBe(true);
    release();
    await Promise.all([slow, fast]);
    expect(state.isSaving).toBe(false);
  });
});

describe('loadSecure', () => {
  const empty: Partial<SettingsState> = { secureStorageError: 'old' };

  it('clears secrets first, then applies the loaded values', async () => {
    const { actions, state, set } = setup();
    const read = vi.fn().mockResolvedValue({ secureStorageError: null, isSaving: false });
    await actions.loadSecure(empty, read);
    expect(set.mock.calls[0][0]).toEqual({ secureStorageError: null });
    expect(read).toHaveBeenCalledWith('p1');
    expect(state).toMatchObject({ isSaving: false });
  });

  it('skips the keychain read when no project is active', async () => {
    const { actions, set } = setup('');
    const read = vi.fn();
    await actions.loadSecure(empty, read);
    expect(read).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('ignores a read result that arrives after the project changed', async () => {
    const { actions, set, switchTo } = setup();
    let finish!: (v: Partial<SettingsState>) => void;
    const pending = actions.loadSecure(empty, () => new Promise((res) => { finish = res; }));
    switchTo('p2');
    finish({ isSaving: true });
    await pending;
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('surfaces read failures for the current project only', async () => {
    const { actions, state, set, switchTo } = setup();
    await actions.loadSecure(empty, () => Promise.reject(new Error('locked')));
    expect(state.secureStorageError).toBe('locked');
    await actions.loadSecure(empty, () => Promise.reject('raw'));
    expect(state.secureStorageError).toBe('raw');
    const before = set.mock.calls.length;
    let fail!: (e: Error) => void;
    const pending = actions.loadSecure(empty, () => new Promise((_, rej) => { fail = rej; }));
    switchTo('p2');
    fail(new Error('x'));
    await pending;
    expect(set.mock.calls.length).toBe(before + 1);
  });
});
