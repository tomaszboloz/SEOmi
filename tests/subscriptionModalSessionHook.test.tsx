import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubscriptionModalSession } from '@/components/Auth/subscriptionModal/useSubscriptionModalSession';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const detectLocalClients = vi.fn(async () => undefined);
const setApiKey = vi.fn(async () => undefined);

const Harness = ({ disabledMiddle = false }: { disabledMiddle?: boolean }) => {
  const s = useSubscriptionModalSession();
  return (
    <div>
      <button>outside</button>
      <div ref={s.dialogRef} tabIndex={-1} data-testid="dialog">
        <button data-testid="first">a</button>
        <button disabled={disabledMiddle}>b</button>
        <button data-testid="last">c</button>
      </div>
    </div>
  );
};

describe('useSubscriptionModalSession', () => {
  beforeEach(() => {
    document.body.style.overflow = 'auto';
    detectLocalClients.mockClear();
    setApiKey.mockReset().mockResolvedValue(undefined);
    useUIStore.setState({ activeModal: 'subscription' });
    useAuthStore.setState({ detectLocalClients, setApiKey } as never);
  });

  it('detects local clients on mount and exposes store state', () => {
    const { result } = renderHook(() => useSubscriptionModalSession());
    expect(detectLocalClients).toHaveBeenCalledTimes(1);
    expect(result.current.provider).toBe(useAuthStore.getState().provider);
    expect(result.current.saving).toBeNull();
    expect(typeof result.current.t).toBe('function');
  });

  it('locks body scroll and restores it and focus on unmount', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const { unmount } = render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(screen.getByTestId('dialog'));
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('closes the modal on Escape', () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('wraps focus forward from last and backward from first on Tab', () => {
    render(<Harness />);
    screen.getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last'));
  });

  it('leaves Tab alone in the middle of the dialog and for other keys', () => {
    render(<Harness disabledMiddle />);
    screen.getByTestId('first').focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    const other = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    document.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(useUIStore.getState().activeModal).toBe('subscription');
  });

  it('ignores Tab when the dialog ref is not attached', () => {
    renderHook(() => useSubscriptionModalSession());
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('ignores Tab when the dialog has no focusable children', () => {
    const Empty = () => <div ref={useSubscriptionModalSession().dialogRef} />;
    render(<Empty />);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('saveKey tracks saving state and clears it afterwards', async () => {
    let release!: () => void;
    setApiKey.mockReturnValueOnce(new Promise<undefined>((r) => { release = () => r(undefined); }));
    const { result } = renderHook(() => useSubscriptionModalSession());
    let pending!: Promise<void>;
    act(() => { pending = result.current.saveKey('openai', 'sk-1'); });
    expect(result.current.saving).toBe('openai');
    expect(setApiKey).toHaveBeenCalledWith('openai', 'sk-1');
    await act(async () => { release(); await pending; });
    expect(result.current.saving).toBeNull();
  });

  it('saveKey swallows store errors and still clears saving', async () => {
    setApiKey.mockRejectedValueOnce(new Error('keychain'));
    const { result } = renderHook(() => useSubscriptionModalSession());
    await act(async () => { await result.current.saveKey('openai', 'x'); });
    await waitFor(() => expect(result.current.saving).toBeNull());
  });

  it('does not try to restore focus to a non-HTML element', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    document.body.appendChild(svg);
    svg.focus();
    expect(document.activeElement).toBe(svg);
    const { unmount } = render(<Harness />);
    unmount();
    expect(document.activeElement).not.toBe(screen.queryByTestId('dialog'));
    svg.remove();
  });
});
