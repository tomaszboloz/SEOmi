import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useModalA11y } from '@/hooks/useModalA11y';

function Dialog({ onClose, empty = false, hiddenFirst = false }: { onClose: () => void; empty?: boolean; hiddenFirst?: boolean }) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  return <div role="dialog" tabIndex={-1} ref={ref}>
    {hiddenFirst && <button style={{ display: 'none' }}>Hidden</button>}
    {!empty && <><button>First</button><button disabled>Disabled</button><button style={{ visibility: 'hidden' }}>Invisible</button><button>Last</button></>}
  </div>;
}
let frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
  frames = new Map();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(frames.size + 1, callback); return frames.size; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.style.overflow = ''; });
const flushFrames = () => act(() => { for (const callback of frames.values()) callback(0); frames.clear(); });

it('focuses the first visible enabled control after mounting', () => {
  render(<Dialog onClose={vi.fn()} hiddenFirst />);
  flushFrames();
  expect(document.activeElement).toBe(screen.getByText('First'));
});

it('restores the opener and preexisting scroll policy on unmount', () => {
  const opener = document.createElement('button');
  document.body.append(opener); opener.focus(); document.body.style.overflow = 'scroll';
  const view = render(<Dialog onClose={vi.fn()} />);
  expect(document.body.style.overflow).toBe('hidden'); flushFrames(); view.unmount();
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe('scroll'); opener.remove();
});

it('wraps Tab and Shift+Tab around visible controls while leaving middle navigation to the browser', () => {
  render(<Dialog onClose={vi.fn()} />); flushFrames();
  expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(screen.getByText('Last'));
  expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
  expect(document.activeElement).toBe(screen.getByText('First'));
  expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true);
});

it('focuses an empty dialog and traps Tab without inventing a control', () => {
  render(<Dialog onClose={vi.fn()} empty />); flushFrames();
  expect(document.activeElement).toBe(screen.getByRole('dialog'));
  expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
  expect(document.activeElement).toBe(screen.getByRole('dialog'));
});

it('prevents Escape and invokes only the active close callback', () => {
  const first = vi.fn(); const latest = vi.fn();
  const view = render(<Dialog onClose={first} />); view.rerender(<Dialog onClose={latest} />);
  expect(fireEvent.keyDown(document, { key: 'Enter' })).toBe(true);
  expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
  expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledOnce();
  view.unmount(); fireEvent.keyDown(document, { key: 'Escape' }); expect(latest).toHaveBeenCalledOnce();
});

it('cancels a pending autofocus frame before an unmounted dialog can steal focus', () => {
  const view = render(<Dialog onClose={vi.fn()} />); view.unmount();
  expect(window.cancelAnimationFrame).toHaveBeenCalledOnce(); expect(frames.size).toBe(0);
});

function FilteredDialog({ mode }: { mode: 'ancestor' | 'inert' | 'negative-tabindex' | 'disabled-fieldset' }) {
  const ref = useModalA11y<HTMLDivElement>(() => undefined);
  return <div role="dialog" tabIndex={-1} ref={ref}>
    {mode === 'ancestor' && <div style={{ display: 'none' }}><button>Excluded</button></div>}
    {mode === 'inert' && <div inert><button>Excluded</button></div>}
    {mode === 'negative-tabindex' && <button tabIndex={-2}>Excluded</button>}
    {mode === 'disabled-fieldset' && <fieldset disabled><button>Excluded</button></fieldset>}
    <button>Allowed</button>
  </div>;
}
it.each(['ancestor', 'inert', 'negative-tabindex', 'disabled-fieldset'] as const)('excludes %s controls from autofocus and keyboard wrapping', mode => {
  render(<FilteredDialog mode={mode} />); flushFrames();
  expect(document.activeElement).toBe(screen.getByText('Allowed'));
  expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(screen.getByText('Allowed'));
  expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
  expect(document.activeElement).toBe(screen.getByText('Allowed'));
});
