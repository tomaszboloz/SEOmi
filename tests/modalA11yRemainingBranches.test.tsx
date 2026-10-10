import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModalA11y } from '@/hooks/useModalA11y';

let focusFrame: FrameRequestCallback | undefined;
let originalRaf: typeof window.requestAnimationFrame;

beforeEach(() => {
  originalRaf = window.requestAnimationFrame;
  focusFrame = undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    focusFrame = callback;
    return 42;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  focusFrame = undefined;
});

describe('useModalA11y edge paths', () => {
  it('ignores a deferred focus and Tab event when no dialog is attached', () => {
    const close = vi.fn();
    renderHook(() => useModalA11y<HTMLDivElement>(close));
    act(() => focusFrame?.(0));
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).not.toHaveBeenCalled();
  });

  it('supports runtimes without requestAnimationFrame', () => {
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: undefined });
    const view = renderHook(() => useModalA11y<HTMLDivElement>(() => undefined));
    expect(() => view.unmount()).not.toThrow();
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRaf });
  });

  it('does not restore a non-HTML active element as the opener', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(svg);
    const view = renderHook(() => useModalA11y<HTMLDivElement>(() => undefined));
    act(() => focusFrame?.(0));
    expect(() => view.unmount()).not.toThrow();
  });
});
