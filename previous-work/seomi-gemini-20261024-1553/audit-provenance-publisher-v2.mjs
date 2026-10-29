import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareReleaseProvenance } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs';
const sha = 'a'.repeat(40), cases = [];
const names = version => ['SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${version}_x64-setup.exe`, `SEOmi_${version}_x64_en-US.msi`, 'latest.json', `SEOmi_${version}_aarch64.dmg`, `SEOmi_${version}_x64.dmg`];
async function run(label, { version = '0.4.40', local = false, invalidSbom = false, draft = true, wrongSha = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-publisher-root-v2-'));
  const files = names(version), uploads = [], downloads = [];
  const assets = files.map((name, i) => ({ id: 100 + i, name, size: ('remote-' + name).length, state: 'uploaded' }));
  if (local) for (const name of files) writeFileSync(join(dir, name), 'local-stale-' + name);
  if (invalidSbom) for (const name of ['sbom-node.json', 'sbom-rust.json']) writeFileSync(join(dir, name), '{"bomFormat":"CycloneDX","components":"invalid"}');
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (options.method === 'POST') {
      uploads.push({ name: new URL(url).searchParams.get('name'), content: String(options.body) });
      return new Response(JSON.stringify({ id: 900 + uploads.length }), { status: 201 });
    }
    if (url.endsWith('/releases/123')) return new Response(JSON.stringify({ id: 123, tag_name: 'v' + version, draft, target_commitish: wrongSha ? 'b'.repeat(40) : sha, assets }));
    const id = Number(url.split('/').at(-1)), asset = assets.find(a => a.id === id);
    if (!asset) throw Error('Unexpected request ' + url);
    downloads.push(asset.name);
    return new Response('remote-' + asset.name);
  };
  try {
    const result = await prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: sha, tag: 'v' + version, token: 'local-fixture', artifactDir: dir, fetchImpl });
    cases.push({ case: label, accepted: true, downloadCount: downloads.length, uploadedNames: uploads.map(x => x.name), subjects: result.inventory.subjects.map(x => x.name), sboms: result.inventory.sboms, firstSubjectHashesLocalFile: result.inventory.subjects[0].sha256 === createHash('sha256').update(readFileSync(join(dir, files[0]))).digest('hex'), tempDir: dir });
  } catch (error) { cases.push({ case: label, accepted: false, error: String(error), uploadedNames: uploads.map(x => x.name), tempDir: dir }); }
}
await run('Real prepare publisher accepts missing Node/Rust SBOM and omits both DMG subjects');
await run('Real prepare publisher accepts malformed SBOM, uploads none of the SBOM payloads', { invalidSbom: true });
await run('Real prepare publisher accepts public release bound to a different source SHA', { draft: false, wrongSha: true });
await run('Next version assets v0.4.41 fail due to hardcoded old Windows names', { version: '0.4.41' });
await run('Pre-existing local subjects bypass download of remote release assets', { local: true });
const report = { at: new Date().toISOString(), scope: 'Original prepareReleaseProvenance function and uploader executed; real isolated filesystem, injected GitHub transport only, no external writes', cases };
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-provenance-publisher-v2-findings.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
