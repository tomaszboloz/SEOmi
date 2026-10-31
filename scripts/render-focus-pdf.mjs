#!/usr/bin/env node
// Site Focus PDF visual review helper (#53 GEM-53-03..06). It does not judge the layout: it
// rasterises the stress PDFs written by the Rust test `tests_focus_visual` and records their
// SHA-256, the source commit and the renderer, so a reviewer can attach PNGs plus a PASS/FAIL
// protocol to the issue.
//
//   SEOMI_FOCUS_PDF_DIR=$PWD/test-results/focus-pdf cargo test --manifest-path src-tauri/Cargo.toml tests_focus_visual
//   node scripts/render-focus-pdf.mjs test-results/focus-pdf
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** PDFs of the directory, sorted; anything else is ignored. */
export const listPdfs = (dir, readDir = readdirSync) =>
  readDir(dir).filter((name) => name.toLowerCase().endsWith('.pdf')).sort();

/** One manifest row per PDF with its hash and the PNG pages produced for it. */
export const buildManifest = ({ dir, commit, renderer, files, readFile = readFileSync, rendered = {} }) => ({
  issue: 53,
  commit,
  renderer,
  verdict: 'PENDING-HUMAN-REVIEW',
  files: files.map((name) => ({ pdf: name, sha256: sha256(readFile(path.join(dir, name))), pngs: rendered[name] ?? [] })),
});

/** Rasterises one PDF with poppler's pdftoppm; returns the PNG names it wrote. */
export const rasterise = (dir, name, run = execFileSync, readDir = readdirSync) => {
  const stem = name.replace(/\.pdf$/i, '');
  run('pdftoppm', ['-png', '-r', '110', path.join(dir, name), path.join(dir, stem)]);
  return readDir(dir).filter((file) => file.startsWith(`${stem}-`) && file.endsWith('.png')).sort();
};

const tryRun = (command, args, run) => {
  try { return String(run(command, args)).trim(); } catch { return null; }
};

export const main = (argv, { run = execFileSync, readDir = readdirSync, readFile = readFileSync, write = writeFileSync, log = console.log } = {}) => {
  const dir = argv[0];
  if (!dir) { log('usage: render-focus-pdf.mjs <dir-with-focus-pdfs>'); return 2; }
  let files;
  try { files = listPdfs(dir, readDir); } catch { log(`cannot read ${dir}`); return 1; }
  if (!files.length) { log(`no PDF in ${dir}; run the tests_focus_visual test with SEOMI_FOCUS_PDF_DIR first`); return 1; }
  const version = tryRun('pdftoppm', ['-v'], (c, a) => run(c, a, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }));
  const rendered = {};
  if (version !== null) files.forEach((name) => { rendered[name] = rasterise(dir, name, run, readDir); });
  else log('pdftoppm not found: hashes only, no PNG pages');
  const manifest = buildManifest({
    dir, files, readFile, rendered,
    commit: tryRun('git', ['rev-parse', 'HEAD'], run) ?? 'unknown',
    renderer: version === null ? 'none' : `pdftoppm ${version.split('\n')[0]}`,
  });
  write(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`${files.length} PDF(s) hashed in ${path.join(dir, 'manifest.json')}`);
  return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
