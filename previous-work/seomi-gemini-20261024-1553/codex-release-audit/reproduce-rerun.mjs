import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

function makeTransport({ failAfterUpload = null } = {}) {
  const releaseAssets = [];
  const bytesById = new Map();
  let nextId = 100;
  for (const name of names) {
    const bytes = Buffer.from(`realistic-release-payload:${name}`);
    const id = nextId++;
    releaseAssets.push({ id, name, size: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` });
    bytesById.set(id, bytes);
  }
  const uploads = [];
  let uploadAttempts = 0;
  const fetchImpl = async (url, options = {}) => {
    const u = String(url);
    if ((options.method ?? 'GET') === 'POST') {
      const name = decodeURIComponent(u.split('name=')[1] ?? '');
      uploadAttempts += 1;
      uploads.push({ name, attempt: uploadAttempts });
      if (releaseAssets.some((a) => a.name === name)) {
        return new Response(JSON.stringify({ message: 'already_exists' }), { status: 422 });
      }
      if (failAfterUpload !== null && uploads.length > failAfterUpload) {
        return new Response(JSON.stringify({ message: 'synthetic transport failure' }), { status: 503 });
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
  const dir = mkdtempSync(join(tmpdir(), 'seomi-provenance-rerun-'));
  writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [{ type: 'library', name: 'node-dep', version: '1.0.0' }] }));
  writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.3', components: [{ type: 'library', name: 'rust-dep', version: '1.0.0' }] }));
  return dir;
}

async function run() {
  const reports = [];
  const fullDir = makeArtifactDir();
  try {
    const transport = makeTransport();
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: fullDir, fetchImpl: transport.fetchImpl };
    await prepareReleaseProvenance(args);
    let secondError = null;
    try { await prepareReleaseProvenance(args); } catch (e) { secondError = String(e.message); }
    reports.push({ scenario: 'successful first run then exact same draft rerun', firstRun: 'PASS', secondRun: secondError ? 'BLOCKED' : 'PASS', secondError, uploads: transport.uploads, remoteNamesAfterFirst: transport.releaseAssets.map((a) => a.name) });
  } finally { rmSync(fullDir, { recursive: true, force: true }); }

  const partialDir = makeArtifactDir();
  try {
    const transport = makeTransport({ failAfterUpload: 2 });
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: partialDir, fetchImpl: transport.fetchImpl };
    let firstError = null;
    try { await prepareReleaseProvenance(args); } catch (e) { firstError = String(e.message); }
    let secondError = null;
    try { await prepareReleaseProvenance(args); } catch (e) { secondError = String(e.message); }
    reports.push({ scenario: 'partial first upload (two support assets) then exact same draft rerun', firstRun: firstError ? 'BLOCKED' : 'PASS', firstError, secondRun: secondError ? 'BLOCKED' : 'PASS', secondError, uploads: transport.uploads, remoteNamesAfterPartial: transport.releaseAssets.map((a) => a.name) });
  } finally { rmSync(partialDir, { recursive: true, force: true }); }

  const digestDir = makeArtifactDir();
  try {
    const transport = makeTransport();
    // A same-size payload with malformed digest metadata exercises the fail-open
    // branch in fetchOrVerifyAsset: extractAssetDigest() returns null and only
    // the advertised size is checked.
    const firstAsset = transport.releaseAssets[0];
    firstAsset.digest = `sha256:${'0'.repeat(63)}`;
    const args = { repository: 'openai/seomi', releaseId: 422833723, commitSha: sha, tag: `v${version}`, token: 'synthetic-token', artifactDir: digestDir, fetchImpl: transport.fetchImpl };
    let error = null;
    try { await prepareReleaseProvenance(args); } catch (e) { error = String(e.message); }
    reports.push({ scenario: 'malformed remote digest with matching-size payload', parser: { input: firstAsset.digest, output: extractAssetDigest(firstAsset) }, accepted: !error, error, note: 'Pipeline accepts because malformed digest becomes null; downloaded bytes are checked only by size.' });
  } finally { rmSync(digestDir, { recursive: true, force: true }); }
  return reports;
}

const reports = await run();
const out = { generatedAt: new Date().toISOString(), source: '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs', scenarios: reports };
mkdirSync('/tmp/seomi-gemini-20261024-1553/codex-release-audit', { recursive: true });
writeFileSync('/tmp/seomi-gemini-20261024-1553/codex-release-audit/repro-rerun.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
