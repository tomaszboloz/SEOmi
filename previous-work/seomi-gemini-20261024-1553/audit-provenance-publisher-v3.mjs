import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareReleaseProvenance } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs';

const sha = 'a'.repeat(40), cases = [];
const names = version => [
  'SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz',
  `SEOmi_${version}_x64-setup.exe`, `SEOmi_${version}_x64_en-US.msi`,
  'latest.json', `SEOmi_${version}_aarch64.dmg`, `SEOmi_${version}_x64.dmg`
];

async function run(label, {
  version = '0.4.40', local = false, invalidSbom = false, noSbom = false,
  draft = true, wrongSha = false, missingDmg = false
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-publisher-root-v3-'));
  const allFiles = names(version);
  const files = missingDmg ? allFiles.filter(f => !f.endsWith('.dmg')) : allFiles;
  const uploads = [], downloads = [];
  const assets = files.map((name, i) => ({ id: 100 + i, name, size: ('remote-' + name).length, state: 'uploaded' }));

  if (local) for (const name of files) writeFileSync(join(dir, name), 'local-stale-' + name);
  if (!noSbom) {
    const comp = invalidSbom ? 'invalid' : [{ name: 'dep', version: '1.0.0' }];
    writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', components: comp }));
    writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', components: comp }));
  }

  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (options.method === 'POST') {
      uploads.push({ name: new URL(url).searchParams.get('name'), content: String(options.body) });
      return new Response(JSON.stringify({ id: 900 + uploads.length }), { status: 201 });
    }
    if (url.endsWith('/releases/123')) {
      return new Response(JSON.stringify({
        id: 123, tag_name: 'v' + version, draft,
        target_commitish: wrongSha ? 'b'.repeat(40) : sha, assets
      }));
    }
    const id = Number(url.split('/').at(-1)), asset = assets.find(a => a.id === id);
    if (!asset) throw Error('Unexpected request ' + url);
    downloads.push(asset.name);
    return new Response('remote-' + asset.name);
  };

  try {
    const result = await prepareReleaseProvenance({
      repository: 'o/r', releaseId: 123, commitSha: sha,
      tag: 'v' + version, token: 'local-fixture', artifactDir: dir, fetchImpl
    });
    cases.push({
      case: label, accepted: true, downloadCount: downloads.length,
      uploadedNames: uploads.map(x => x.name),
      subjects: result.inventory.subjects.map(x => x.name),
      sboms: result.inventory.sboms,
      firstSubjectHashesLocalFile: result.inventory.subjects[0].sha256 === createHash('sha256').update(readFileSync(join(dir, files[0]))).digest('hex'),
      tempDir: dir
    });
  } catch (error) {
    cases.push({
      case: label, accepted: false, error: String(error),
      uploadedNames: uploads.map(x => x.name), tempDir: dir
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await run('Missing Node/Rust SBOM reject with zero uploads', { noSbom: true });
await run('Malformed SBOM components reject with zero uploads', { invalidSbom: true });
await run('Public release bound to wrong source SHA reject with zero uploads', { draft: false, wrongSha: true });
await run('Missing DMG asset reject with zero uploads', { missingDmg: true });
await run('Cache tamper / stale local size mismatch reject with zero uploads', { local: true });
await run('Complete pipeline success for v0.4.41 with 4 uploads, 7 subjects and 2 SBOMs', { version: '0.4.41' });
await run('Complete pipeline success for v0.4.40 with 4 uploads, 7 subjects and 2 SBOMs', { version: '0.4.40' });

const report = {
  at: new Date().toISOString(),
  scope: 'prepareReleaseProvenance v3 with authoritative checks, fail-closed SBOM/DMG/SHA/draft validation, cache tamper detection, and 4-asset upload pipeline',
  cases
};
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-provenance-publisher-v3-findings.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
