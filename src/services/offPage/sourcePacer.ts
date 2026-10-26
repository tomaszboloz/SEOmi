const pause = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  signal.throwIfAborted();
  const stop = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, milliseconds);
  signal.addEventListener('abort', stop, { once: true });
});

export const createSourcePacer = () => {
  let turn = Promise.resolve();
  let starts: number[] = [];
  return (signal: AbortSignal): Promise<void> => {
    const operation = turn.then(async () => {
      signal.throwIfAborted();
      const now = Date.now();
      starts = starts.filter((start) => now - start < 60_050);
      const interval = (starts.at(-1) ?? -Infinity) + 160 - now;
      const window = starts.length >= 10 ? starts[0] + 60_050 - now : 0;
      const delay = Math.max(0, interval, window);
      if (delay) await pause(delay, signal);
      signal.throwIfAborted();
      starts.push(Date.now());
    });
    turn = operation.catch(() => undefined);
    return operation;
  };
};

export const waitForSourceSlot = createSourcePacer();
