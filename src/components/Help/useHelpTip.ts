import type { RefObject } from 'react';
import { useCallback, useEffect, useId, useRef } from 'react';
import type { PointerEvent, MouseEvent, FocusEvent } from 'react';
import { useHelpStore } from './helpStore';

export const OPEN_DELAY_MS = 250;
export const CLOSE_DELAY_MS = 150;

/**
 * Open/close behaviour for one help tip: hover (delayed, pointer may move into
 * the popover), keyboard focus, click/tap toggle ("pinned"), Esc, outside
 * pointer press, blur. The global store keeps a single tip open at a time.
 */
export const useHelpTip = () => {
  const uid = useId();
  const open = useHelpStore((s) => s.openId === uid);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pinned = useRef(false);

  const clear = () => clearTimeout(timer.current);
  const show = useCallback(() => useHelpStore.getState().open(uid), [uid]);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    pinned.current = false;
    useHelpStore.getState().close(uid);
  }, [uid]);

  useEffect(() => () => hide(), [hide]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      hide();
    };
    const onPress = (event: Event) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) hide();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPress, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPress, true);
    };
  }, [open, hide]);

  const enter = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    clear();
    if (!open) timer.current = setTimeout(show, OPEN_DELAY_MS);
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    clear();
    if (!pinned.current) timer.current = setTimeout(hide, CLOSE_DELAY_MS);
  };
  const click = (event: MouseEvent) => {
    event.stopPropagation();
    clear();
    if (open && pinned.current) return hide();
    pinned.current = true;
    show();
  };

  const blur = (other: RefObject<HTMLElement | null>) => (event: FocusEvent) => {
    if (!other.current?.contains(event.relatedTarget as Node | null)) hide();
  };

  const trigger = { onPointerEnter: enter, onPointerLeave: leave, onClick: click, onFocus: show, onBlur: blur(popoverRef) };
  const hover = { onPointerEnter: enter, onPointerLeave: leave, onBlur: blur(buttonRef) };
  return { uid, open, buttonRef, popoverRef, trigger, hover };
};
