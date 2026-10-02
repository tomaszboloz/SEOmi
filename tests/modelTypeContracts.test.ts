// @vitest-environment node
import { expect, it } from 'vitest';
import { exportedTypeContract } from './fixtures/typeContracts';

it('preserves every crawler export, property type, optional flag and declaration order', () => {
  expect(exportedTypeContract('src/types/crawl.ts')).toEqual({
    exports: 37,
    sha256: '1a8cacd51a9b8216b11bcd6022e916a4b84be1d9100af0686e509fdcb2eab177',
  });
});

it('preserves every audit export, property type, optional flag and declaration order', () => {
  expect(exportedTypeContract('src/types/audit.ts')).toEqual({
    exports: 35,
    sha256: '62a78ea80ca71c772571e0a25117950fb09249a5d5d39a9f6b9342b60fee0453',
  });
});
