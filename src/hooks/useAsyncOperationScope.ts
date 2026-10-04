import { useLayoutEffect, useRef, useCallback } from 'react';

/** Keeps async UI completions owned by the mounted owner and latest operation. */
export const useAsyncOperationScope = (ownerKey: string | null) => {
  const generation = useRef(0);
  const operations = useRef(new Map<string, symbol>());
  useLayoutEffect(() => {
    generation.current += 1;
    operations.current.clear();
    return () => {
      generation.current += 1;
      operations.current.clear();
    };
  }, [ownerKey]);
  return useCallback((kind: string) => {
    const owner = generation.current;
    const token = Symbol(kind);
    operations.current.set(kind, token);
    return () => generation.current === owner && operations.current.get(kind) === token;
  }, []);
};
