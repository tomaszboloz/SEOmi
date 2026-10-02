import { useEffect, useRef, useState } from 'react';
import type { PaletteItem } from './commandPaletteTypes';

interface UseCommandPaletteSessionParams {
  open: boolean;
  close: () => void;
  filteredItems: PaletteItem[];
}

export function useCommandPaletteSession({ open, close, filteredItems }: UseCommandPaletteSessionParams) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const run = (action: () => void) => {
    close();
    setQuery('');
    setActiveIndex(0);
    action();
  };

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setQuery('');
    setActiveIndex(0);
    const focus = () => inputRef.current?.focus();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focus);
    } else {
      focus();
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filteredItems.length) setActiveIndex(Math.max(0, filteredItems.length - 1));
  }, [activeIndex, filteredItems.length]);

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => filteredItems.length ? (index + 1) % filteredItems.length : 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => filteredItems.length ? (index - 1 + filteredItems.length) % filteredItems.length : 0);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(Math.max(0, filteredItems.length - 1));
        return;
      }
      if (event.key === 'Tab') {
        const dialog = document.getElementById('command-palette-dialog');
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === 'Enter' && filteredItems[activeIndex]) {
        event.preventDefault();
        filteredItems[activeIndex].action();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, close, filteredItems, open]);

  return {
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    inputRef,
    activeOptionRef,
    run,
  };
}
