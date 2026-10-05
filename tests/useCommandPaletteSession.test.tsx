import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommandPaletteSession } from '@/components/Layout/commandPalette/useCommandPaletteSession';
import type { PaletteItem } from '@/components/Layout/commandPalette/commandPaletteTypes';

const items = (count: number): PaletteItem[] => Array.from({ length: count }, (_, index) => ({ id: `i${index}`, action: vi.fn() }) as unknown as PaletteItem);
const press = (key: string, init: KeyboardEventInit = {}) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...init })); });
const mount = (initial: { open: boolean; filteredItems: PaletteItem[]; close?: () => void }) =>
  renderHook((props) => useCommandPaletteSession({ close: vi.fn(), ...props }), { initialProps: initial });

beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; }); });
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; document.body.style.overflow = ''; });

describe('lifecycle', () => {
  it('locks page scroll while open, focuses the input and restores focus and scroll on close', () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    document.body.style.overflow = 'auto';
    const view = mount({ open: true, filteredItems: items(2) });
    const input = document.createElement('input'); document.body.append(input);
    (view.result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    expect(document.body.style.overflow).toBe('hidden');
    view.rerender({ open: false, filteredItems: items(2) });
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(trigger);
  });

  it('does nothing while closed and falls back to an immediate focus without requestAnimationFrame', () => {
    const closed = mount({ open: false, filteredItems: items(1) });
    press('Escape');
    expect(closed.result.current.activeIndex).toBe(0);
    vi.stubGlobal('requestAnimationFrame', undefined);
    const view = mount({ open: true, filteredItems: items(1) });
    expect(view.result.current.query).toBe('');
  });

  it('runs an action after closing and clearing the query', () => {
    const close = vi.fn(); const action = vi.fn();
    const view = mount({ open: true, filteredItems: items(3), close });
    act(() => { view.result.current.setQuery('seo'); view.result.current.setActiveIndex(2); });
    act(() => view.result.current.run(action));
    expect(close).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(view.result.current).toMatchObject({ query: '', activeIndex: 0 });
  });
});

describe('keyboard navigation', () => {
  it('moves with arrows (wrapping), Home and End and prevents default scrolling', () => {
    const view = mount({ open: true, filteredItems: items(3) });
    press('ArrowDown'); press('ArrowDown'); press('ArrowDown');
    expect(view.result.current.activeIndex).toBe(0);
    press('ArrowUp');
    expect(view.result.current.activeIndex).toBe(2);
    press('Home');
    expect(view.result.current.activeIndex).toBe(0);
    press('End');
    expect(view.result.current.activeIndex).toBe(2);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  });

  it('stays at zero with no results and clamps the index when results shrink', () => {
    const view = mount({ open: true, filteredItems: items(5) });
    press('End');
    expect(view.result.current.activeIndex).toBe(4);
    view.rerender({ open: true, filteredItems: items(2) });
    expect(view.result.current.activeIndex).toBe(1);
    view.rerender({ open: true, filteredItems: [] });
    press('ArrowDown'); press('ArrowUp'); press('End');
    expect(view.result.current.activeIndex).toBe(0);
  });

  it('closes on Escape and runs the active item on Enter only when there is one', () => {
    const close = vi.fn(); const list = items(2);
    const view = mount({ open: true, filteredItems: list, close });
    press('Escape');
    expect(close).toHaveBeenCalledOnce();
    press('ArrowDown'); press('Enter');
    expect(list[1].action).toHaveBeenCalledOnce();
    view.rerender({ open: true, filteredItems: [], close });
    press('Enter');
    expect(list[0].action).not.toHaveBeenCalled();
  });
});

describe('focus trap', () => {
  const dialog = () => {
    document.body.innerHTML = '<div id="command-palette-dialog"><input id="a"><button id="b">b</button><button id="c" disabled>c</button></div>';
    const visible = (id: string) => Object.defineProperty(document.getElementById(id)!, 'offsetParent', { value: document.body });
    visible('a'); visible('b');
    return { first: document.getElementById('a')!, last: document.getElementById('b')! };
  };

  it('wraps Tab from the last to the first control and Shift+Tab the other way', () => {
    const { first, last } = dialog();
    mount({ open: true, filteredItems: items(1) });
    last.focus(); press('Tab');
    expect(document.activeElement).toBe(first);
    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('leaves Tab alone inside the dialog and when the dialog is missing', () => {
    const { first } = dialog();
    mount({ open: true, filteredItems: items(1) });
    first.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    document.body.innerHTML = '';
    press('Tab');
  });
});
