import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareReleaseProvenance } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/scripts/release-ci-gate-provenance.mjs';

const ROOT = '/Users/tomaszboloz/.codex/worktrees/release-next/seomi';
const VERSION = '0.4.41';
const TAG = `v${VERSION}`;
const RELEASE_ID = 410041;
const SHA = 'f'.repeat(40);
const NAMES = [
  'SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz',
  `SEOmi_${VERSION}_x64-setup.exe`, `SEOmi_${VERSION}_x64_en-US.msi`,
  'latest.json', `SEOmi_${VERSION}_aarch64.dmg`, `SEOmi_${VERSION}_x64.dmg`,
];
const hash = (b) => createHash('sha256').update(b).digest('hex');

function transport({ releaseId = RELEASE_ID, tag = TAG, targetCommitish = SHA } = {}) {
  const assets = [], bytes = new Map(), uploads = [], downloads = [];
  let nextId = 100;
  for (const name of NAMES) {
    const body = Buffer.from(`root-0.4.41-artifact:${name}`), id = nextId++;
    assets.push({ id, name, size: body.length, digest: `sha256:${hash(body)}` });
    bytes.set(id, body);
  }
  const fetchImpl = async (input, options = {}) => {
    const url = String(input), method = options.method ?? 'GET';
    if (method === 'POST') {
      const name = decodeURIComponent(url.split('name=')[1] ?? '');
      uploads.push(name);
      if (assets.some((a) => a.name === name)) return new Response('duplicate', { status: 422 });
      const body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body ?? ''));
      const id = nextId++;
      assets.push({ id, name, size: body.length, digest: `sha256:${hash(body)}` }); bytes.set(id, body);
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    if (url.endsWith(`/releases/${RELEASE_ID}`)) {
      return new Response(JSON.stringify({ id: releaseId, tag_name: tag, draft: true, target_commitish: targetCommitish, assets: assets.map((a) => ({ ...a })) }), { status: 200 });
    }
    if (url.includes('/releases/assets/')) {
      const id = Number(url.split('/').pop()); downloads.push(id);
      const body = bytes.get(id); return body ? new Response(body, { status: 200 }) : new Response('missing', { status: 404 });
    }
    return new Response('unexpected', { status: 404 });
  };
  return { fetchImpl, assets, uploads, downloads };
}

function artifacts() {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-root-0441-'));
  writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [{ type: 'library', name: 'node-root-0441', version: '1.0.0' }] }));
  writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.3', components: [{ type: 'library', name: 'rust-root-0441', version: '1.0.0' }] }));
  return dir;
}

async function runValid() {
  const dir = artifacts(), t = transport();
  try {
    const result = await prepareReleaseProvenance({ repository: 'o/r', releaseId: RELEASE_ID, commitSha: SHA, tag: TAG, token: 'fixture', artifactDir: dir, fetchImpl: t.fetchImpl });
    const subjects = result.inventory.subjects.map((s) => s.name);
    return { status: 'PASS', version: result.inventory.version, subjects, expectedSubjects: NAMES, subjectCount: subjects.length, uploads: t.uploads, downloads: t.downloads.length, exactDynamicSubjects: JSON.stringify(subjects) === JSON.stringify(NAMES), exactFourMetadataUploads: t.uploads.length === 4 };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function runReject(label, overrides, expected) {
  const dir = artifacts(), t = transport(overrides);
  try {
    let error = null;
    try { await prepareReleaseProvenance({ repository: 'o/r', releaseId: RELEASE_ID, commitSha: SHA, tag: TAG, token: 'fixture', artifactDir: dir, fetchImpl: t.fetchImpl }); } catch (e) { error = String(e.message); }
    return { case: label, status: error && error.includes(expected) && t.uploads.length === 0 && t.downloads.length === 0 ? 'PASS' : 'FAIL', error, expected, uploads: t.uploads.length, downloads: t.downloads.length };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const sourceFiles = ['scripts/release-ci-gate-provenance.mjs', 'scripts/release-ci-gate-provenance-upload.mjs', 'scripts/release-ci-gate-publish.mjs', '.github/workflows/release.yml', 'package.json'];
const sourceHashes = Object.fromEntries(sourceFiles.map((rel) => [rel, hash(readFileSync(join(ROOT, rel)))]));
const result = {
  generatedAt: new Date().toISOString(), root: ROOT, head: 'ac49603379086268d0da39f04052f8fb89098be7', candidateVersion: VERSION,
  sourceHashes,
  scenarios: {
    valid: await runValid(),
    rejectTagMismatch: await runReject('tag mismatch', { tag: 'v0.4.40' }, 'Release tag mismatch'),
    rejectShaMismatch: await runReject('commit SHA mismatch', { targetCommitish: 'a'.repeat(40) }, 'target_commitish mismatch'),
    rejectIdMismatch: await runReject('release ID mismatch', { releaseId: 410042 }, 'Release ID mismatch'),
  },
  productionOIDCClaim: false, realReleaseMutation: false,
};
writeFileSync('/tmp/seomi-gemini-20261024-1553/codex-root-0441-publisher-acceptance.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
