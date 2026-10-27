import { vi } from 'vitest';
import { createGscSlice } from '@/stores/tools/gscSlice';
import { useProjectStore } from '@/stores/projectStore';
import { toolRequestTokens } from '@/stores/tools/runtime';
import { isolatedToolsSlice } from './toolsSlice';

export function gscSliceFixture() {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'gsc-direct', projects: [] });
  toolRequestTokens.clear();
  const invoke = vi.fn();
  const fixture = isolatedToolsSlice(createGscSlice, { invoke });
  fixture.store.setState({ isGscConnected: true, gscClientId: 'client', gscClientSecret: '', gscProperty: 'sc-domain:example.com' });
  return { ...fixture, invoke };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
