// @vitest-environment node
import { expect, it, vi } from 'vitest';
import ts from 'typescript';
import { exportedTypeContract } from './fixtures/typeContracts';

it('preserves the reviewed crawler contract including optional project ownership and semantic language', () => {
  expect(exportedTypeContract('src/types/crawl.ts')).toEqual({
    exports: 37,
    sha256: 'b4205664cf3748d32ca0960a0f61637a8f692daf2cc0bbe7944cd136e7968ed4',
  });
});

it('preserves every audit export, property type, optional flag and declaration order', () => {
  expect(exportedTypeContract('src/types/audit.ts')).toEqual({
    exports: 35,
    sha256: '62a78ea80ca71c772571e0a25117950fb09249a5d5d39a9f6b9342b60fee0453',
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
