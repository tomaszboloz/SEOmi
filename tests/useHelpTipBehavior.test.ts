import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_DELAY_MS, OPEN_DELAY_MS, useHelpTip } from '@/components/Help/useHelpTip';
import { useHelpStore } from '@/components/Help/helpStore';

const mouse = { pointerType: 'mouse' } as never;
const clickEvent = () => ({ stopPropagation: vi.fn() });

beforeEach(() => { vi.useFakeTimers(); useHelpStore.setState({ openId: null }); });
afterEach(() => vi.useRealTimers());

describe('useHelpTip', () => {
  it('opens after the hover delay and closes after the leave delay', () => {
    const { result } = renderHook(() => useHelpTip());
    act(() => result.current.trigger.onPointerEnter(mouse));
    act(() => { vi.advanceTimersByTime(OPEN_DELAY_MS - 1); });
    expect(result.current.open).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.open).toBe(true);
    act(() => result.current.trigger.onPointerLeave(mouse));
    act(() => { vi.advanceTimersByTime(CLOSE_DELAY_MS); });
    expect(result.current.open).toBe(false);
  });

  it('ignores touch hover and cancels a pending open on leave', () => {
    const { result } = renderHook(() => useHelpTip());
    act(() => result.current.trigger.onPointerEnter({ pointerType: 'touch' } as never));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.open).toBe(false);
    act(() => result.current.trigger.onPointerEnter(mouse));
    act(() => result.current.trigger.onPointerLeave(mouse));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.open).toBe(false);
  });

  it('pins on click so leave does not close, and a second click closes', () => {
    const { result } = renderHook(() => useHelpTip());
    const first = clickEvent();
    act(() => result.current.trigger.onClick(first as never));
    expect(first.stopPropagation).toHaveBeenCalled();
    expect(result.current.open).toBe(true);
    act(() => result.current.trigger.onPointerLeave(mouse));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.open).toBe(true);
    act(() => result.current.trigger.onClick(clickEvent() as never));
    expect(result.current.open).toBe(false);
  });

  it('closes on Escape and on outside press but not on inside press', () => {
    const { result } = renderHook(() => useHelpTip());
    act(() => result.current.trigger.onFocus());
    expect(result.current.open).toBe(true);
    const inside = document.createElement('div');
    document.body.append(inside);
    (result.current.popoverRef as { current: HTMLElement | null }).current = inside;
    act(() => { inside.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(result.current.open).toBe(true);
    act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(result.current.open).toBe(false);
    act(() => result.current.trigger.onFocus());
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); });
    expect(result.current.open).toBe(true);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.open).toBe(false);
    inside.remove();
  });

  it('blur closes unless focus moves into the popover; only one tip is open at a time', () => {
    const a = renderHook(() => useHelpTip());
    const b = renderHook(() => useHelpTip());
    act(() => a.result.current.trigger.onFocus());
    act(() => b.result.current.trigger.onFocus());
    expect(a.result.current.open).toBe(false);
    expect(b.result.current.open).toBe(true);
    const pop = document.createElement('div');
    const child = document.createElement('button');
    pop.append(child);
    (b.result.current.popoverRef as { current: HTMLElement | null }).current = pop;
    act(() => b.result.current.trigger.onBlur({ relatedTarget: child } as never));
    expect(b.result.current.open).toBe(true);
    act(() => b.result.current.trigger.onBlur({ relatedTarget: null } as never));
    expect(b.result.current.open).toBe(false);
  });

  it('closes on unmount', () => {
    const { result, unmount } = renderHook(() => useHelpTip());
    act(() => result.current.trigger.onFocus());
    expect(useHelpStore.getState().openId).toBe(result.current.uid);
    unmount();
    expect(useHelpStore.getState().openId).toBeNull();
  });
});
