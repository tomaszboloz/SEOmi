/** Recursively freezes plain objects/arrays so a snapshot can never be mutated. */
export const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return Object.freeze(value);
};

/** Detached, deeply frozen copy: shares no mutable reference with the source. */
export const freezeCopy = <T>(value: T): Readonly<T> => deepFreeze(structuredClone(value));
