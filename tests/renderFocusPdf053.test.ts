import { describe, expect, it, vi } from 'vitest';
import { buildManifest, listPdfs, main, sha256 } from '../scripts/render-focus-pdf.mjs';

const files: Record<string, string> = { 'focus-en.pdf': '%PDF-en', 'focus-ar.pdf': '%PDF-ar' };
const readFile = (file: string) => files[file.split(/[\\/]/).pop() as string];

describe('render-focus-pdf (#53)', () => {
  it('lists only PDFs, sorted, and hashes each one', () => {
    expect(listPdfs('d', () => ['b.png', 'focus-en.pdf', 'focus-ar.PDF', 'notes.txt'])).toEqual(['focus-ar.PDF', 'focus-en.pdf']);
    const manifest = buildManifest({ dir: 'd', commit: 'abc', renderer: 'pdftoppm 24', files: ['focus-en.pdf'], readFile, rendered: { 'focus-en.pdf': ['focus-en-1.png'] } });
    expect(manifest).toEqual({
      issue: 53, commit: 'abc', renderer: 'pdftoppm 24', verdict: 'PENDING-HUMAN-REVIEW',
      files: [{ pdf: 'focus-en.pdf', sha256: sha256('%PDF-en'), pngs: ['focus-en-1.png'] }],
    });
    expect(buildManifest({ dir: 'd', commit: 'c', renderer: 'none', files: ['focus-ar.pdf'], readFile }).files[0].pngs).toEqual([]);
  });

  it('rasterises every PDF, records the commit and writes the manifest', () => {
    const calls: string[][] = [];
    const run = vi.fn((command: string, args: string[]) => {
      calls.push([command, ...args]);
      if (command === 'git') return 'deadbeef\n';
      return command === 'pdftoppm' && args[0] === '-v' ? 'pdftoppm version 24.02.0\nCopyright' : '';
    });
    const write = vi.fn();
    const readDir = () => ['focus-ar.pdf', 'focus-ar-1.png', 'focus-en.pdf', 'focus-en-1.png', 'focus-en-2.png'];
    expect(main(['out'], { run, readDir, readFile, write, log: vi.fn() })).toBe(0);
    expect(calls.filter((call) => call[1] === '-png')).toHaveLength(2);
    const manifest = JSON.parse(write.mock.calls[0][1]);
    expect(write.mock.calls[0][0]).toMatch(/out[\\/]manifest\.json$/);
    expect(manifest.commit).toBe('deadbeef');
    expect(manifest.renderer).toBe('pdftoppm pdftoppm version 24.02.0');
    expect(manifest.files[1]).toMatchObject({ pdf: 'focus-en.pdf', pngs: ['focus-en-1.png', 'focus-en-2.png'] });
  });

  it('falls back to hashes only without pdftoppm or git, and fails clearly on bad input', () => {
    const run = vi.fn(() => { throw new Error('missing'); });
    const write = vi.fn();
    const log = vi.fn();
    expect(main(['out'], { run, readDir: () => ['focus-en.pdf'], readFile, write, log })).toBe(0);
    expect(JSON.parse(write.mock.calls[0][1])).toMatchObject({ commit: 'unknown', renderer: 'none' });
    expect(log).toHaveBeenCalledWith('pdftoppm not found: hashes only, no PNG pages');
    expect(main([], { log })).toBe(2);
    expect(main(['empty'], { readDir: () => [], log })).toBe(1);
    expect(main(['gone'], { readDir: () => { throw new Error('ENOENT'); }, log })).toBe(1);
  });
});
