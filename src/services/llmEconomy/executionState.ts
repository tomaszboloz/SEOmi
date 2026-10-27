const inFlight = new Map<string, Promise<unknown>>();
export const IN_FLIGHT_TTL_MS = 5 * 60 * 1000;
export const MAX_IN_FLIGHT = 64;

/** Shares bounded provider work only; caller-specific policy is applied outside. */
export const shareInFlight = <T>(key: string, run: () => Promise<T>): Promise<T> => {
  const previous = inFlight.get(key);
  if (previous) return previous as Promise<T>;
  const current = run();
  inFlight.set(key, current);
  const timer = setTimeout(() => {
    if (inFlight.get(key) === current) inFlight.delete(key);
  }, IN_FLIGHT_TTL_MS);
  (timer as unknown as { unref?: () => void }).unref?.();
  while (inFlight.size > MAX_IN_FLIGHT) {
    const oldest = inFlight.keys().next().value;
    if (typeof oldest !== 'string') break;
    inFlight.delete(oldest);
  }
  return current.finally(() => {
    clearTimeout(timer);
    if (inFlight.get(key) === current) inFlight.delete(key);
  });
};
