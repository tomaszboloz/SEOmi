import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FolderPlus } from 'lucide-react';
import { useCommandPaletteSession } from '@/components/Layout/commandPalette/useCommandPaletteSession';
import type { PaletteItem } from '@/components/Layout/commandPalette/commandPaletteTypes';

afterEach(() => { document.body.replaceChildren(); document.body.style.overflow = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const item = (id: string): PaletteItem => ({ id, label: id, group: 'test', keywords: id, icon: FolderPlus, action: vi.fn() });
function setup(open = true, filteredItems = [item('a'), item('b'), item('c')]) {
  const props = { open, filteredItems, close: vi.fn() };
  return { ...renderHook(useCommandPaletteSession, { initialProps: props }), props };
}
function key(value: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key: value, shiftKey, cancelable: true });
  act(() => { window.dispatchEvent(event); });
  return event;
}

it('does not focus the detached palette input when its scheduled frame runs after close', () => {
  let frame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 17; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  document.body.style.overflow = 'scroll';
  const { result, props, rerender } = setup(false);
  const input = document.createElement('input'); document.body.append(input);
  result.current.inputRef.current = input;
  const focus = vi.spyOn(input, 'focus');
  rerender({ ...props, open: true });
  expect(document.body.style.overflow).toBe('hidden');
  rerender({ ...props, open: false }); input.remove();
  act(() => frame(0));
  expect(focus).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe('scroll');
  expect(cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(17);
});

it('focuses on open without RAF and restores focus and overflow on unmount', () => {
  vi.stubGlobal('requestAnimationFrame', undefined);
  const opener = document.createElement('button'); const input = document.createElement('input');
  document.body.append(opener, input); opener.focus(); document.body.style.overflow = 'auto';
  const { result, props, rerender, unmount } = setup(false);
  result.current.inputRef.current = input;
  act(() => { result.current.setQuery('old'); result.current.setActiveIndex(2); });
  rerender({ ...props, open: true });
  expect(document.activeElement).toBe(input); expect(result.current.query).toBe(''); expect(result.current.activeIndex).toBe(0);
  unmount(); expect(document.activeElement).toBe(opener); expect(document.body.style.overflow).toBe('auto');
});

it('wraps keyboard indexes, honors Home/End, dispatches Enter and closes on Escape', () => {
  const { result, props } = setup();
  expect(key('ArrowUp').defaultPrevented).toBe(true); expect(result.current.activeIndex).toBe(2);
  key('ArrowDown'); expect(result.current.activeIndex).toBe(0);
  key('End'); expect(result.current.activeIndex).toBe(2);
  key('Home'); expect(result.current.activeIndex).toBe(0);
  expect(key('Enter').defaultPrevented).toBe(true); expect(props.filteredItems[0].action).toHaveBeenCalledOnce();
  expect(key('Escape').defaultPrevented).toBe(true); expect(props.close).toHaveBeenCalledOnce();
  expect(key('x').defaultPrevented).toBe(false);
});

it('clamps selection after filtering and retains zero for an empty list', () => {
  const { result, props, rerender } = setup();
  act(() => result.current.setActiveIndex(2));
  rerender({ ...props, filteredItems: [props.filteredItems[0]] }); expect(result.current.activeIndex).toBe(0);
  rerender({ ...props, filteredItems: [] });
  key('ArrowUp'); key('ArrowDown'); key('End'); key('Home');
  expect(result.current.activeIndex).toBe(0); expect(key('Enter').defaultPrevented).toBe(false);
  expect(props.filteredItems[0].action).not.toHaveBeenCalled();
});

it('runs actions after closing and resets query/index', () => {
  const { result, props } = setup(); const action = vi.fn();
  act(() => { result.current.setQuery('query'); result.current.setActiveIndex(1); });
  act(() => result.current.run(action));
  expect(props.close).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledOnce();
  expect(props.close.mock.invocationCallOrder[0]).toBeLessThan(action.mock.invocationCallOrder[0]);
  expect(result.current.query).toBe(''); expect(result.current.activeIndex).toBe(0);
});

it('does not handle keys while closed or after unmount', () => {
  const { props, rerender, unmount } = setup(false);
  expect(key('Escape').defaultPrevented).toBe(false);
  rerender({ ...props, open: true }); unmount();
  expect(key('Escape').defaultPrevented).toBe(false); expect(props.close).not.toHaveBeenCalled();
});

it('scrolls the selected option into view when selection changes', () => {
  const { result } = setup(); const option = document.createElement('button');
  const scroll = vi.fn(); option.scrollIntoView = scroll; result.current.activeOptionRef.current = option;
  key('ArrowDown'); expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
});

it('traps Tab at enabled visible endpoints and leaves inner focus or missing dialogs alone', () => {
  setup(); expect(key('Tab').defaultPrevented).toBe(false);
  const dialog = document.createElement('section'); dialog.id = 'command-palette-dialog'; document.body.append(dialog);
  expect(key('Tab').defaultPrevented).toBe(false);
  const first = document.createElement('input'); const middle = document.createElement('button'); const last = document.createElement('button');
  const disabled = document.createElement('button'); disabled.disabled = true;
  const hidden = document.createElement('button');
  for (const node of [first, middle, last, disabled]) Object.defineProperty(node, 'offsetParent', { value: dialog });
  dialog.append(first, middle, last, disabled, hidden);
  first.focus(); expect(key('Tab', true).defaultPrevented).toBe(true); expect(document.activeElement).toBe(last);
  expect(key('Tab').defaultPrevented).toBe(true); expect(document.activeElement).toBe(first);
  middle.focus(); expect(key('Tab').defaultPrevented).toBe(false); expect(key('Tab', true).defaultPrevented).toBe(false);
});

it('guards queued focus on unmount even when cancelAnimationFrame is unavailable', () => {
  let frame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 0; }));
  vi.stubGlobal('cancelAnimationFrame', undefined);
  const { result, props, rerender, unmount } = setup(false);
  const input = document.createElement('input'); const focus = vi.spyOn(input, 'focus');
  result.current.inputRef.current = input;
  rerender({ ...props, open: true }); unmount();
  act(() => frame(0)); expect(focus).not.toHaveBeenCalled();
});

it('focuses the current input when the scheduled opening frame executes', () => {
  let frame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const { result, props, rerender } = setup(false);
  const input = document.createElement('input'); document.body.append(input); result.current.inputRef.current = input;
  rerender({ ...props, open: true }); act(() => frame(0)); expect(document.activeElement).toBe(input);
});
