import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareReleaseProvenance } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs';
import { extractAssetDigest } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance-upload.mjs';

const sha = 'e'.repeat(40);
const version = '0.4.40';
const names = [
  'SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz',
  `SEOmi_${version}_x64-setup.exe`, `SEOmi_${version}_x64_en-US.msi`,
  'latest.json', `SEOmi_${version}_aarch64.dmg`, `SEOmi_${version}_x64.dmg`,
];

function makeTransport({ failAfterUpload = null, badDigest = false, noDigest = false } = {}) {
  const releaseAssets = [];
  const bytesById = new Map();
  let nextId = 100;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const bytes = Buffer.from(`realistic-release-payload:${name}`);
    const id = nextId++;
    const digest = badDigest && i === 0
      ? `sha256:${'0'.repeat(63)}`
      : (noDigest ? undefined : `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    releaseAssets.push({ id, name, size: bytes.length, digest });
    bytesById.set(id, bytes);
  }
  const uploads = [];
  let uploadAttempts = 0;
  const fetchImpl = async (url, options = {}) => {
    const u = String(url), m = options.method ?? 'GET';
    if (m === 'DELETE') {
      const id = Number(u.split('/').pop());
      const idx = releaseAssets.findIndex((a) => a.id === id);
      if (idx >= 0) releaseAssets.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
    if (m === 'POST') {
      const name = decodeURIComponent(u.split('name=')[1] ?? '');
      uploadAttempts += 1;
      uploads.push({ name, attempt: uploadAttempts });
      if (failAfterUpload !== null && uploads.length === failAfterUpload) {
        return new Response(JSON.stringify({ message: 'synthetic transport failure' }), { status: 503 });
      }
      if (releaseAssets.some((a) => a.name === name)) {
        return new Response(JSON.stringify({ message: 'already_exists' }), { status: 422 });
      }
      const id = nextId++;
      releaseAssets.push({ id, name, size: Number(options.body?.length ?? 0) });
      bytesById.set(id, Buffer.from(options.body ?? ''));
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    if (u.endsWith('/releases/422833723')) {
      return new Response(JSON.stringify({ id: 422833723, tag_name: `v${version}`, draft: true, target_commitish: sha, assets: [...releaseAssets] }), { status: 200 });
    }
    const id = Number(u.split('/').pop());
    const bytes = bytesById.get(id);
    if (!bytes) return new Response('missing', { status: 404 });
    return new Response(bytes, { status: 200 });
  };
  return { fetchImpl, releaseAssets, uploads };
}

function makeArtifactDir() {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-provenance-rerun-v5-'));
  writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [{ type: 'library', name: 'node-dep', version: '1.0.0' }] }));
  writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.3', components: [{ type: 'library', name: 'rust-dep', version: '1.0.0' }] }));
  return dir;
}

async function run() {
  const reports = [];

  // Scenario 1: Successful first run then exact same draft rerun (idempotence)
  const fullDir = makeArtifactDir();
  try {
    const transport = makeTransport();
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: fullDir, fetchImpl: transport.fetchImpl };
    const res1 = await prepareReleaseProvenance(args);
    let secondError = null;
    let res2 = null;
    try { res2 = await prepareReleaseProvenance(args); } catch (e) { secondError = String(e.message); }
    reports.push({
      scenario: 'successful first run then exact same draft rerun',
      firstRun: res1 ? 'PASS' : 'FAIL',
      secondRun: secondError ? 'BLOCKED' : 'PASS',
      secondError,
      uploadsTotal: transport.uploads.length,
      remoteNamesAfterFirst: transport.releaseAssets.map((a) => a.name)
    });
  } finally { rmSync(fullDir, { recursive: true, force: true }); }

  // Scenario 2: Partial first upload (fail on 3rd upload) then exact same draft rerun resumes
  const partialDir = makeArtifactDir();
  try {
    const transport = makeTransport({ failAfterUpload: 3 });
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: partialDir, fetchImpl: transport.fetchImpl };
    let firstError = null;
    try { await prepareReleaseProvenance(args); } catch (e) { firstError = String(e.message); }
    // Remove failure injection for rerun
    let secondError = null;
    let resPartial = null;
    try { resPartial = await prepareReleaseProvenance(args); } catch (e) { secondError = String(e.message); }
    reports.push({
      scenario: 'partial first upload (2 support assets uploaded, 3rd fails with 503) then resume',
      firstRun: firstError ? 'EXPECTED_FAIL_503' : 'UNEXPECTED_PASS',
      firstError,
      secondRun: secondError ? 'BLOCKED' : 'PASS',
      secondError,
      subjects: resPartial?.inventory?.subjects?.length ?? 0,
      remoteNamesAfterPartial: transport.releaseAssets.map((a) => a.name)
    });
  } finally { rmSync(partialDir, { recursive: true, force: true }); }

  // Scenario 3: Malformed supplied digest fails closed before download
  const digestDir = makeArtifactDir();
  try {
    const transport = makeTransport({ badDigest: true });
    const firstAsset = transport.releaseAssets[0];
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: digestDir, fetchImpl: transport.fetchImpl };
    let error = null;
    try { await prepareReleaseProvenance(args); } catch (e) { error = String(e.message); }
    reports.push({
      scenario: 'malformed remote digest (63 hex) rejects fail closed with zero uploads',
      parser: { input: firstAsset.digest, output: extractAssetDigest(firstAsset) },
      accepted: !error,
      error,
      uploadsCount: transport.uploads.length
    });
  } finally { rmSync(digestDir, { recursive: true, force: true }); }

  // Scenario 4: Absent digest fresh download PASS
  const noDigestDir = makeArtifactDir();
  try {
    const transport = makeTransport({ noDigest: true });
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: noDigestDir, fetchImpl: transport.fetchImpl };
    let error = null;
    let resNoDigest = null;
    try { resNoDigest = await prepareReleaseProvenance(args); } catch (e) { error = String(e.message); }
    reports.push({
      scenario: 'digest absent from GitHub API fresh downloads by assetId and completes pipeline',
      accepted: !error,
      error,
      subjects: resNoDigest?.inventory?.subjects?.length ?? 0,
      uploadsCount: transport.uploads.length
    });
  } finally { rmSync(noDigestDir, { recursive: true, force: true }); }

  return reports;
}

const reports = await run();
const out = {
  generatedAt: new Date().toISOString(),
  scope: 'prepareReleaseProvenance v5: Idempotent metadata upload/reuse, partial retry, digest parsing hardening, absent digest fresh download',
  scenarios: reports
};
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-provenance-rerun-v5-findings.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
