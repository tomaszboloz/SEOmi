import { describe, expect, it } from 'vitest';
import { assertLLVMLineEvidence, llvmLineEvidence } from '../scripts/native-llvm-lines.mjs';

describe('LLVM physical source line evidence', () => {
  const file = { segments: [
    [1, 1, 7, true, true, false],
    [3, 1, 0, false, true, false],
    [4, 1, 0, true, true, true],
    [5, 1, 2, true, true, false],
    [5, 5, 0, false, false, false],
  ], summary: { lines: { count: 999, covered: 999 } } };

  it('preserves wrapped counts, skipped lines, gap entries and source coordinates', () => {
    expect([...llvmLineEvidence(file, 5)]).toEqual([[1, 7], [2, 7], [4, 0], [5, 2]]);
    expect(() => assertLLVMLineEvidence(file, ['DA:1,7', 'DA:2,7', 'DA:4,0', 'DA:5,2'], 5)).not.toThrow();
  });

  it('takes the largest counted region entry on a mapped line', () => {
    expect([...llvmLineEvidence({ segments: [
      [1, 1, 3, true, true, false], [2, 1, 1, true, true, false],
      [2, 10, 9, true, true, false], [2, 20, 0, false, false, false],
    ] }, 2)]).toEqual([[1, 3], [2, 9]]);
  });

  it('rejects missing, duplicate and modified LCOV counters rather than fabricating hits', () => {
    expect(() => assertLLVMLineEvidence(file, ['DA:1,7'], 5)).toThrow('evidence differ');
    expect(() => assertLLVMLineEvidence(file, ['DA:1,7', 'DA:1,7'], 5)).toThrow('duplicate');
    expect(() => assertLLVMLineEvidence(file, ['DA:1,0'], 5)).toThrow('evidence differ');
    expect(() => assertLLVMLineEvidence(file, ['DA:1,NaN'], 5)).toThrow('Invalid');
  });

  it('rejects invalid, unordered and out-of-source segments', () => {
    for (const segment of [[0, 1, 0, true, true, false], [6, 1, 0, true, true, false],
      [1, 1, -1, true, true, false], [1, 1, 0, 1, true, false]]) {
      expect(() => llvmLineEvidence({ segments: [segment] }, 5)).toThrow('Invalid');
    }
    expect(() => llvmLineEvidence({ segments: [file.segments[1], file.segments[0]] }, 5)).toThrow('Invalid');
    expect(() => llvmLineEvidence({}, 5)).toThrow('Missing');
    expect([...llvmLineEvidence({ segments: [] }, 5)]).toEqual([]);
  });
});
