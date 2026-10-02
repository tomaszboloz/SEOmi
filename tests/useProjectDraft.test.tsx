import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useProjectDraft } from '@/components/Projects/useProjectDraft';
import { useProjectStore } from '@/stores/projectStore';

const initial = useProjectStore.getState();
const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => useProjectStore.setState(initial, true));

it('owns a name error, focuses the caller and clears it once a name is typed', () => {
  const onInvalidName = vi.fn();
  const { result } = renderHook(() => useProjectDraft({ onInvalidName }));
  act(() => result.current.submit(submitEvent()));
  expect(result.current.validationField).toBe('name');
  expect(result.current.errorFor('name')).not.toBe('');
  expect(result.current.errorFor('rootUrl')).toBe('');
  expect(onInvalidName).toHaveBeenCalledOnce();
  act(() => result.current.setName('Shop'));
  expect(result.current.validationField).toBeNull();
});

it('creates a valid project and reports store failures on the root URL field', () => {
  const createProject = vi.fn();
  useProjectStore.setState({ createProject });
  const onCreated = vi.fn();
  const { result } = renderHook(() => useProjectDraft({ onCreated }));
  act(() => { result.current.setName('Shop'); result.current.setRootUrl('https://shop.test/'); });
  act(() => result.current.submit(submitEvent()));
  expect(createProject).toHaveBeenCalledExactlyOnceWith({ name: 'Shop', rootUrl: expect.stringContaining('shop.test') });
  expect(onCreated).toHaveBeenCalledOnce();
  createProject.mockImplementation(() => { throw new Error('quota exceeded'); });
  act(() => result.current.submit(submitEvent()));
  expect(result.current.errorFor('rootUrl')).toBe('quota exceeded');
  act(() => result.current.setRootUrl('https://other.test/'));
  expect(result.current.errorFor('rootUrl')).toBe('');
});
