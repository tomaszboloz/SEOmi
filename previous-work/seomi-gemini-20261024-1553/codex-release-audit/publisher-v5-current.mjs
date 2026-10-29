import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareReleaseProvenance } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs';
import { extractAssetDigest } from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance-upload.mjs';

const ROOT = '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi';
const RELEASE_ID = 422833723;
const SHA = 'e'.repeat(40);
const VERSION = '0.4.40';
const TAG = `v${VERSION}`;
const REQUIRED = [
  'SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${VERSION}_x64-setup.exe`,
  `SEOmi_${VERSION}_x64_en-US.msi`, 'latest.json', `SEOmi_${VERSION}_aarch64.dmg`, `SEOmi_${VERSION}_x64.dmg`,
];
const PROVENANCE = ['sbom-node.json', 'sbom-rust.json', 'SHA256SUMS.txt', 'release-provenance.json'];
const FOREIGN = ['SEOmi_0.4.40_x64-setup.exe.sig', 'SEOmi_0.4.40_x64_en-US.msi.sig', 'public-release-notes.txt', 'third-party.json'];
const HASH_EXPECTED = {
  'scripts/release-ci-gate-provenance.mjs': 'b34f0a83b90a235d67e7b16eb15456588e90ff74c496c4b752204b9b1cae2283',
  'scripts/release-ci-gate-provenance-upload.mjs': 'a3adb0905c80cfdb44525f4287d259a389586a2c7490708d3d711c02b29dada9',
  'scripts/release-ci-gate-publish.mjs': '6f80984faa7549323e4720bb268d282c11a406ed139c050a48fe211248abadd8',
  '.github/workflows/release.yml': '9d35bd4f23643e663945ec1a89e34ae7d16e858086dbfaa4d502ca463e2e17e4',
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtureBytes = (name) => Buffer.from(`v5-runtime-fixture:${name}`);

function makeTransport({ failureAt = null, initialProvenance = [], digestMode = 'valid' } = {}) {
  const assets = [];
  const content = new Map();
  const events = [];
  let nextId = 1000;
  const addAsset = (name, bytes, { digest = true } = {}) => {
    const id = nextId++;
    const value = Buffer.from(bytes);
    assets.push({ id, name, size: value.length, ...(digest ? { digest: `sha256:${sha256(value)}` } : {}) });
    content.set(id, value);
    return id;
  };
  for (const name of REQUIRED) {
    const bytes = fixtureBytes(name);
    addAsset(name, bytes, { digest: digestMode === 'absent' ? false : true });
  }
  for (const name of FOREIGN) addAsset(name, fixtureBytes(name));
  for (const name of initialProvenance) addAsset(name, Buffer.from(`old-owned-metadata:${name}`));

  let postCount = 0;
  const fetchImpl = async (input, options = {}) => {
    const url = String(input), method = options.method ?? 'GET';
    const isRelease = url.endsWith(`/releases/${RELEASE_ID}`);
    if (method === 'POST' && url.includes('/assets?name=')) {
      const name = decodeURIComponent(url.split('name=')[1]);
      postCount += 1;
      events.push({ method: 'POST', name, postCount });
      if (failureAt !== null && postCount === failureAt) return new Response('temporary failure', { status: 503 });
      if (assets.some((a) => a.name === name)) return new Response(JSON.stringify({ message: 'already_exists' }), { status: 422 });
      const body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body ?? ''));
      const id = addAsset(name, body, { digest: true });
      return new Response(JSON.stringify(assets.find((a) => a.id === id)), { status: 201 });
    }
    if (method === 'DELETE' && url.includes('/releases/assets/')) {
      const id = Number(url.split('/').pop());
      const a = assets.find((x) => x.id === id);
      events.push({ method: 'DELETE', id, name: a?.name ?? null });
      if (a) { assets.splice(assets.indexOf(a), 1); content.delete(id); }
      return new Response(null, { status: 204 });
    }
    if (isRelease) return new Response(JSON.stringify({ id: RELEASE_ID, tag_name: TAG, draft: true, target_commitish: SHA, assets: assets.map((x) => ({ ...x })) }), { status: 200 });
    if (url.includes('/releases/assets/')) {
      const id = Number(url.split('/').pop());
      const bytes = content.get(id);
      if (!bytes) return new Response('missing', { status: 404 });
      events.push({ method: 'GET_ASSET', id, name: assets.find((x) => x.id === id)?.name ?? null });
      return new Response(bytes, { status: 200 });
    }
    return new Response('unexpected endpoint', { status: 404 });
  };
  return { fetchImpl, assets, content, events, get postCount() { return postCount; } };
}

function makeArtifacts() {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-v5-current-'));
  for (const name of ['sbom-node.json', 'sbom-rust.json']) writeFileSync(join(dir, name), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [{ name }] }));
  return dir;
}

const argsFor = (dir, transport) => ({ repository: 'openai/seomi', releaseId: RELEASE_ID, commitSha: SHA, tag: TAG, token: 'runtime-fixture', artifactDir: dir, fetchImpl: transport.fetchImpl });
const eventNames = (transport, method) => transport.events.filter((e) => e.method === method).map((e) => e.name);

async function fullRerun() {
  const dir = makeArtifacts(), transport = makeTransport();
  try {
    await prepareReleaseProvenance(argsFor(dir, transport));
    const afterFirst = transport.assets.map((a) => a.name);
    await prepareReleaseProvenance(argsFor(dir, transport));
    return { first: 'PASS', second: 'PASS', postNames: eventNames(transport, 'POST'), deleteNames: eventNames(transport, 'DELETE'), afterFirst, afterSecond: transport.assets.map((a) => a.name) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function partialRetry() {
  const dir = makeArtifacts(), transport = makeTransport({ failureAt: 3 });
  try {
    let firstError = null;
    try { await prepareReleaseProvenance(argsFor(dir, transport)); } catch (e) { firstError = String(e.message); }
    const beforeRetry = transport.assets.map((a) => a.name);
    // The synthetic 503 is one-shot because postCount has already advanced to 3.
    await prepareReleaseProvenance(argsFor(dir, transport));
    return { first: 'EXPECTED_FAIL_503', firstError, second: 'PASS', beforeRetry, finalNames: transport.assets.map((a) => a.name), postNames: eventNames(transport, 'POST'), deleteNames: eventNames(transport, 'DELETE') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function absentDigest() {
  const dir = makeArtifacts(), transport = makeTransport({ digestMode: 'absent' });
  try {
    const stale = fixtureBytes(REQUIRED[0]);
    writeFileSync(join(dir, REQUIRED[0]), Buffer.alloc(stale.length, 0x5a));
    await prepareReleaseProvenance(argsFor(dir, transport));
    return { accepted: true, staleCacheReplaced: readFileSync(join(dir, REQUIRED[0])).compare(stale) === 0, assetGetCount: transport.events.filter((e) => e.method === 'GET_ASSET').length };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function malformedDigest() {
  const dir = makeArtifacts(), transport = makeTransport();
  transport.assets[0].digest = `sha256:${'0'.repeat(63)}`;
  try {
    let error = null;
    try { await prepareReleaseProvenance(argsFor(dir, transport)); } catch (e) { error = String(e.message); }
    return { accepted: !error, error, parser: extractAssetDigest(transport.assets[0]), uploads: eventNames(transport, 'POST'), assetGets: transport.events.filter((e) => e.method === 'GET_ASSET').length };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function ownedMetadataOnly() {
  const dir = makeArtifacts(), transport = makeTransport({ initialProvenance: ['sbom-node.json'] });
  const beforeForeign = new Map(FOREIGN.map((name) => { const a = transport.assets.find((x) => x.name === name); return [name, { id: a.id, hash: sha256(transport.content.get(a.id)) }]; }));
  try {
    await prepareReleaseProvenance(argsFor(dir, transport));
    const deletes = eventNames(transport, 'DELETE');
    const posts = eventNames(transport, 'POST');
    const afterForeign = new Map(FOREIGN.map((name) => { const a = transport.assets.find((x) => x.name === name); return [name, { id: a.id, hash: sha256(transport.content.get(a.id)) }]; }));
    const foreignStable = JSON.stringify([...beforeForeign]) === JSON.stringify([...afterForeign]);
    return { accepted: true, posts, deletes, exactlyFourOwned: PROVENANCE.every((n) => transport.assets.some((a) => a.name === n)) && transport.assets.filter((a) => PROVENANCE.includes(a.name)).length === 4, foreignStable, protectedNames: REQUIRED.concat(FOREIGN), forbiddenMutationNames: deletes.concat(posts).filter((n) => !PROVENANCE.includes(n)) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function sourceHashes() {
  const actual = Object.fromEntries(Object.keys(HASH_EXPECTED).map((rel) => [rel, sha256(readFileSync(join(ROOT, rel)))]));
  return { actual, expected: HASH_EXPECTED, stable: Object.keys(actual).every((k) => actual[k] === HASH_EXPECTED[k]) };
}

const result = { generatedAt: new Date().toISOString(), sourceRoot: ROOT, sourceHashes: sourceHashes(), scenarios: { fullRerun: await fullRerun(), partialRetry: await partialRetry(), absentDigest: await absentDigest(), malformedDigest: await malformedDigest(), ownedMetadataOnly: await ownedMetadataOnly() }, externalMutation: false, realReleaseMutation: false, oidcProductionClaim: false };
writeFileSync('/tmp/seomi-gemini-20261024-1553/codex-publisher-v5-current.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
