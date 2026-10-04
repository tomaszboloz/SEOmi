import { useLayoutEffect, useRef } from 'react';

/** Keeps async UI completions owned by the mounted project and latest operation. */
export const useCrawlOperationScope = (projectId: string | null) => {
  const generation = useRef(0);
  const operations = useRef(new Map<string, symbol>());
  useLayoutEffect(() => {
    generation.current += 1;
    operations.current.clear();
    return () => {
      generation.current += 1;
      operations.current.clear();
    };
  }, [projectId]);
  return (kind: string) => {
    const owner = generation.current;
    const token = Symbol(kind);
    operations.current.set(kind, token);
    return () => generation.current === owner && operations.current.get(kind) === token;
  };
};
