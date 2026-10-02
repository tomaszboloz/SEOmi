import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State that reverts to `idle` after `durationMs` (copy/saved confirmations).
 * A new `flash` restarts the single timer, so an earlier timeout can never
 * clear a later confirmation, and the timer is cleared on unmount.
 */
export const useTransientValue = <T,>(idle: T, durationMs: number): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(idle);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef(idle);
  idleRef.current = idle;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flash = useCallback((next: T) => {
    if (timer.current) clearTimeout(timer.current);
    setValue(next);
    timer.current = setTimeout(() => {
      timer.current = null;
      setValue(idleRef.current);
    }, durationMs);
  }, [durationMs]);

  return [value, flash];
};
