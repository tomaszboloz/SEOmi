import { createStore } from 'zustand/vanilla';
import { createToolsInitialState } from '@/stores/tools/initialState';
import { useToolsStore } from '@/stores/toolsStore';
import { toolsServices } from '@/stores/tools/services';
import type { ToolsGet, ToolsServices, ToolsSet, ToolsState } from '@/stores/tools/contracts';

export function isolatedToolsSlice<T extends Partial<ToolsState>>(
  factory: (set: ToolsSet, get: ToolsGet, services: ToolsServices) => T,
  overrides: Partial<ToolsServices> = {},
) {
  const services = { ...toolsServices, ...overrides };
  const store = createStore<ToolsState>(() => ({ ...useToolsStore.getState(), ...createToolsInitialState() }));
  const actions = factory(store.setState, store.getState, services);
  store.setState(actions);
  return { store, actions, services };
}
