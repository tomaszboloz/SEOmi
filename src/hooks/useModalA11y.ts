import { useEffect, useRef } from 'react';

type Focusable = HTMLElement;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const visibleControls = (dialog: HTMLElement): Focusable[] =>
  Array.from(dialog.querySelectorAll<Focusable>(focusableSelector)).filter(element => {
    if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert]')) return false;
    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hidden || window.getComputedStyle(ancestor).display === 'none') return false;
    }
    return true;
  });

/**
 * Shared modal behaviour for desktop WebViews.
 * Keeps keyboard users inside the dialog, restores the opener and prevents
 * the page behind the overlay from scrolling while a modal is active.
 */
export const useModalA11y = <T extends HTMLElement>(onClose: () => void) => {
  const dialogRef = useRef<T>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusDialog = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = visibleControls(dialog)[0];
      (first || dialog).focus();
    };

    const frame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(focusDialog)
      : undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = visibleControls(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [onClose]);

  return dialogRef;
};
