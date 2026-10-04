import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { useAuditStore } from '@/stores/auditStore';
import { useUIStore } from '@/stores/uiStore';

const startAudit = vi.fn(); const setActiveTab = vi.fn(); const openModal = vi.fn(); const closeModal = vi.fn(); const openCommandPalette = vi.fn();
const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
  act(() => { window.dispatchEvent(event); });
  return event;
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuditStore.setState({ currentAudit: { url: 'https://a.test/' } as never, startAudit, setActiveTab } as never);
  useUIStore.setState({ activeModal: null, openModal, closeModal, openCommandPalette } as never);
});
afterEach(() => { document.body.innerHTML = ''; });

describe('modifier shortcuts', () => {
  it('focuses the URL field with Ctrl/Cmd+K and prevents the browser default', () => {
    document.body.innerHTML = '<input id="url-input-field">';
    renderHook(() => useKeyboardShortcuts());
    const event = press('K', { ctrlKey: true });
    expect(document.activeElement?.id).toBe('url-input-field');
    expect(event.defaultPrevented).toBe(true);
    document.body.innerHTML = '';
    expect(press('k', { metaKey: true }).defaultPrevented).toBe(true);
  });

  it('opens the command palette only with Shift', () => {
    renderHook(() => useKeyboardShortcuts());
    press('p', { ctrlKey: true });
    expect(openCommandPalette).not.toHaveBeenCalled();
    press('P', { ctrlKey: true, shiftKey: true });
    expect(openCommandPalette).toHaveBeenCalledOnce();
  });

  it('re-runs the current audit with Ctrl/Cmd+R but leaves reload alone without one', () => {
    renderHook(() => useKeyboardShortcuts());
    expect(press('r', { metaKey: true }).defaultPrevented).toBe(true);
    expect(startAudit).toHaveBeenCalledWith('https://a.test/');
    act(() => { useAuditStore.setState({ currentAudit: null } as never); });
    startAudit.mockClear();
    expect(press('r', { metaKey: true }).defaultPrevented).toBe(false);
    expect(startAudit).not.toHaveBeenCalled();
  });

  it('opens settings and the AI assistant', () => {
    renderHook(() => useKeyboardShortcuts());
    press(',', { ctrlKey: true });
    press('I', { metaKey: true });
    expect(openModal).toHaveBeenNthCalledWith(1, 'settings');
    expect(openModal).toHaveBeenNthCalledWith(2, 'ai');
  });

  it.each([['1', 'overview'], ['4', 'metadata'], ['8', 'performance']])('jumps to a tab with Ctrl+%s', (key, tab) => {
    renderHook(() => useKeyboardShortcuts());
    press(key, { ctrlKey: true });
    expect(setActiveTab).toHaveBeenCalledWith(tab);
  });

  it('ignores digits without a modifier and unmapped digits', () => {
    renderHook(() => useKeyboardShortcuts());
    expect(press('1').defaultPrevented).toBe(false);
    expect(press('9', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});

describe('Escape and lifecycle', () => {
  it('closes an open modal and ignores Escape otherwise', () => {
    renderHook(() => useKeyboardShortcuts());
    expect(press('Escape').defaultPrevented).toBe(false);
    expect(closeModal).not.toHaveBeenCalled();
    act(() => { useUIStore.setState({ activeModal: 'settings' } as never); });
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(closeModal).toHaveBeenCalledOnce();
  });

  it('removes its listener on unmount', () => {
    const view = renderHook(() => useKeyboardShortcuts());
    view.unmount();
    press(',', { ctrlKey: true });
    expect(openModal).not.toHaveBeenCalled();
  });
});
