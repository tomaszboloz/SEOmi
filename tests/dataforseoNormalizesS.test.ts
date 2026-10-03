import { describe, expect, it, vi } from 'vitest';
import { normalizeDataForSeoDomain } from '../src/services/dataforseo';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

describe('domain normalization contract before consolidation', () => {

it.each([
    ['https://WWW.Example.com.:443/path?query=1', 'example.com'],
    ['https://www.bücher.de:8443/path', 'xn--bcher-kva.de'],
    [' Example.COM ', 'example.com'],
  ])('normalizes %s', (value, expected) => expect(normalizeDataForSeoDomain(value)).toBe(expected));

it.each(['', 'localhost', 'ftp://example.com', 'https://user:secret@example.com', 'https://[broken'])('rejects %s', (value) => {
    expect(() => normalizeDataForSeoDomain(value)).toThrow();
  });
});
