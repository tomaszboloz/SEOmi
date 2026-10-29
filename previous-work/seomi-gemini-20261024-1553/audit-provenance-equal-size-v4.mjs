import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareReleaseProvenance } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs';

const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const version = '0.4.41', tag = 'v' + version, sha = 'a'.repeat(40), repository = 'o/r';
const names = ['SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${version}_x64-setup.exe`, `SEOmi_${version}_x64_en-US.msi`, 'latest.json', `SEOmi_${version}_aarch64.dmg`, `SEOmi_${version}_x64.dmg`];
const remoteBytes = new Map(names.map((name, i) => [name, Buffer.alloc(100 + i, 65 + i)]));
const platforms = Object.fromEntries(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64'].map((platform, index) => [platform, { url: `https://github.com/o/r/releases/download/${tag}/${names[index]}`, signature: 'fixture-signature' }]));
remoteBytes.set('latest.json', Buffer.from(JSON.stringify({ version, platforms })));
const assets = names.map((name, i) => ({ id: 100 + i, name, size: remoteBytes.get(name).length, state: 'uploaded', digest: 'sha256:' + digest(remoteBytes.get(name)) }));

const cases = [];
for (const tamper of [false, true]) {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-equal-size-root-v4-'));
  const validSbom = JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', version: 1, components: [{ type: 'library', name: 'fixture', version: '1' }] });
  for (const name of ['sbom-node.json', 'sbom-rust.json']) writeFileSync(join(dir, name), validSbom);
  if (tamper) writeFileSync(join(dir, names[0]), Buffer.alloc(remoteBytes.get(names[0]).length, 90));
  const uploads = [], downloads = [];
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (options.method === 'POST') { uploads.push({ name: new URL(url).searchParams.get('name'), content: String(options.body) }); return new Response('{"id":900}', { status: 201 }); }
    if (url.endsWith('/releases/123')) return new Response(JSON.stringify({ id: 123, draft: true, tag_name: tag, target_commitish: sha, assets }));
    const asset = assets.find(a => a.id === Number(url.split('/').at(-1)));
    if (!asset) throw Error('Unexpected request: ' + url);
    downloads.push(asset.name);
    return new Response(remoteBytes.get(asset.name));
  };
  try {
    const result = await prepareReleaseProvenance({ repository, releaseId: 123, commitSha: sha, tag, token: 'fixture-only', artifactDir: dir, fetchImpl });
    const subject = result.inventory.subjects.find(a => a.name === names[0]);
    cases.push({
      case: tamper ? 'Equal-size stale payload with different authoritative remote digest' : 'Complete authoritative fixture with valid SBOM and no local cache',
      accepted: true,
      downloads,
      uploadedNames: uploads.map(a => a.name),
      authoritativeDigest: assets[0].digest,
      attestedDigest: 'sha256:' + subject.sha256,
      matchesRemote: subject.sha256 === digest(remoteBytes.get(names[0])),
      diskDigest: digest(readFileSync(join(dir, names[0])))
    });
  } catch (error) {
    cases.push({
      case: tamper ? 'Equal-size stale payload' : 'Positive complete fixture',
      accepted: false,
      error: String(error),
      uploads: uploads.length
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const report = {
  at: new Date().toISOString(),
  scope: 'prepareReleaseProvenance v4 with cryptographic SHA256 digest verification for both local cache and downloaded buffer, duplicate asset check, and path containment',
  cases
};
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-provenance-equal-size-v4-findings.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
