// @vitest-environment node
import { expect, it, vi } from 'vitest';
import ts from 'typescript';
import { exportedTypeContract } from './fixtures/typeContracts';

it('preserves the reviewed crawler contract including optional project ownership and semantic language', () => {
  expect(exportedTypeContract('src/types/crawl.ts')).toEqual({
    exports: 37,
    sha256: 'f0fef4f2208ab5ef85ff1fa6be773b8b20418e94edfaa4ee3b6d37ed5e9cf43f',
  });
});

it('preserves every audit export, property type, optional flag and declaration order', () => {
  expect(exportedTypeContract('src/types/audit.ts')).toEqual({
    exports: 35,
    sha256: 'e8bcd54ac98a9547c027e3d2e39286721794d7594b3af19c2a1c43ef6cfb81a3',
  });
});

it('resolves the complete type graph without loading unrelated ambient declarations', () => {
  const readFile = ts.sys.readFile;
  const reads: string[] = [];
  const spy = vi.spyOn(ts.sys, 'readFile').mockImplementation(path => {
    reads.push(path.replace(/\\/g, '/'));
    return readFile(path);
  });
  try {
    expect(exportedTypeContract('src/types/crawl.ts').exports).toBe(37);
    expect(reads.filter(path => path.includes('/node_modules/') && path.endsWith('.d.ts'))).toEqual([]);
    expect(reads.some(path => path.endsWith('/types/crawl/page.ts'))).toBe(true);
  } finally { spy.mockRestore(); }
});
