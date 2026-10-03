import { vi } from 'vitest';

export function fakeCrawlDatabase() {
  const request = { result: undefined as unknown, error: null as Error | null,
    onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
  const transaction = { error: null as Error | null,
    oncomplete: null as null | (() => void), onerror: null as null | (() => void),
    onabort: null as null | (() => void), objectStore: vi.fn() };
  const store = { get: vi.fn(() => request), put: vi.fn() };
  transaction.objectStore.mockReturnValue(store);
  const db = { objectStoreNames: { contains: vi.fn(() => false) },
    createObjectStore: vi.fn(), close: vi.fn(), transaction: vi.fn(() => transaction) };
  const open = { result: db, error: null as Error | null,
    onupgradeneeded: null as null | (() => void),
    onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
  vi.stubGlobal('indexedDB', { open: vi.fn(() => open) });
  return { open, db, store, request, transaction };
}

export async function openFakeDatabase(fake: ReturnType<typeof fakeCrawlDatabase>) {
  fake.open.onupgradeneeded?.();
  fake.open.onsuccess?.();
  await Promise.resolve();
}
