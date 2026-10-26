import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { REQUIRED_PLATFORMS } from './release-ci-gate-assets.mjs';
import { manifestRepository, validateManifestFragment, expectedManifestFileNames } from './release-manifest-validation.mjs';
import { remoteMacAssetName, selectSignedMacBundle } from './release-manifest-naming.mjs';
import { validateGithubApiBase, validateReleaseId, validateReleaseTag, validateReleaseVersion, validateRepository } from './release-input-validation.mjs';
import { readReleaseFile, writeReleaseFileAtomically } from './release-atomic-file.mjs';
export const PLATFORM_KEY_MAP = Object.freeze({
  'macos-15': 'darwin-aarch64',
  'macos-15-intel': 'darwin-x86_64',
  'windows-latest': 'windows-x86_64',
});
export const computeRemoteAssetName = (localPath, platformKey, version) => {
  const localName = basename(localPath);
  if (platformKey === 'darwin-aarch64' || platformKey === 'darwin-x86_64') return remoteMacAssetName(localPath, platformKey, version);
  const expectedNames = expectedManifestFileNames(platformKey, version);
  if (!expectedNames.includes(localName)) throw new Error(`Unexpected updater artifact for ${platformKey}: ${localName}`);
  return localName;
};
export const findFiles = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const full = join(dir, e.name);
    return e.isDirectory() ? findFiles(full) : [full];
  });
};
export const extractPlatformFragment = ({
  platform, targetDir = 'src-tauri/target', repository, tag,
}) => {
  const platformKey = PLATFORM_KEY_MAP[platform] ?? platform;
  const validRepository = validateRepository(repository);
  const validTag = validateReleaseTag(tag);
  const version = validTag.slice(1);
  const expectedNames = expectedManifestFileNames(platformKey, version);
  const files = findFiles(targetDir);
  const sigFiles = files.filter((f) => f.endsWith('.sig'));
  let bundlePath = null;
  let sigPath = null;
  if (platformKey === 'windows-x86_64') {
    bundlePath = expectedNames.map((name) => files.find((f) => basename(f) === name && files.includes(`${f}.sig`))).find(Boolean) ?? null;
    sigPath = bundlePath ? `${bundlePath}.sig` : null;
  } else {
    const selected = selectSignedMacBundle({ files, sigFiles, platform: platformKey, version });
    if (selected) ({ bundlePath, sigPath } = selected);
  }

  if (!bundlePath || !sigPath) {
    throw new Error(`No signed updater artifact found for platform ${platform} in ${targetDir}`);
  }
  const signature = readReleaseFile(sigPath, targetDir).toString('utf8').trim();
  const remoteFileName = computeRemoteAssetName(bundlePath, platformKey, version);
  const entry = {
    signature,
    url: `https://github.com/${validRepository}/releases/download/${validTag}/${remoteFileName}`,
  };
  if (!expectedNames.includes(remoteFileName)) throw new Error(`Unexpected updater artifact for platform ${platformKey}: ${remoteFileName}`);
  const fragment = validateManifestFragment({ platform: platformKey, entry }, { version, repository: validRepository });
  writeReleaseFileAtomically(`updater-manifest-${platform}.json`, JSON.stringify(fragment, null, 2));
  return fragment;
};
export const consolidateManifests = async ({
  manifestDir = 'updater-manifests', candidateVersion, repository, releaseId,
  token, apiUrl = 'https://api.github.com', fetchImpl = fetch,
}) => {
  const version = validateReleaseVersion(typeof candidateVersion === 'string' ? candidateVersion.replace(/^v/, '') : candidateVersion);
  const validRepository = repository === undefined ? undefined : validateRepository(repository);
  if (releaseId !== undefined) validateReleaseId(releaseId);
  validateGithubApiBase(apiUrl);
  const files = findFiles(manifestDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) throw new Error('Manifest directory contains no JSON fragments');
  const platforms = {};
  let inferredRepository = validRepository;
  for (const f of files) {
    const data = JSON.parse(readReleaseFile(f, manifestDir).toString('utf8'));
    const normalized = validateManifestFragment(data, { version, repository: inferredRepository });
    if (!inferredRepository) inferredRepository = manifestRepository(normalized);
    if (platforms[normalized.platform]) {
      throw new Error(`Conflicting duplicate platform fragment for ${normalized.platform}`);
    }
    platforms[normalized.platform] = normalized.entry;
  }
  const missing = REQUIRED_PLATFORMS.filter((p) => !platforms[p]);
  if (missing.length > 0) throw new Error(`Consolidated manifest missing platforms: ${missing.join(', ')}`);
  const latestJson = {
    version,
    notes: `SEOmi v${version}`,
    pub_date: new Date().toISOString(),
    platforms,
  };
  const jsonString = JSON.stringify(latestJson, null, 2);
  writeReleaseFileAtomically('latest.json', jsonString);
  if (releaseId && token && inferredRepository) {
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
    const getRes = await fetchImpl(`${apiUrl}/repos/${inferredRepository}/releases/${releaseId}`, { headers });
    if (!getRes.ok) throw new Error(`Failed to fetch release ${releaseId} during consolidation: HTTP ${getRes.status}`);
    const rel = await getRes.json();
    const existing = (rel.assets ?? []).find((a) => a.name === 'latest.json');
    if (existing) {
      const existingId = validateReleaseId(existing.id);
      const delRes = await fetchImpl(`${apiUrl}/repos/${inferredRepository}/releases/assets/${existingId}`, { method: 'DELETE', headers });
      if (!delRes.ok) throw new Error(`Failed to delete existing latest.json asset ${existing.id}: HTTP ${delRes.status}`);
    }
    validateGithubApiBase('https://uploads.github.com', true);
    const uploadUrl = `https://uploads.github.com/repos/${inferredRepository}/releases/${releaseId}/assets?name=latest.json`;
    const upRes = await fetchImpl(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: jsonString,
    });
    if (!upRes.ok) throw new Error(`Failed to upload consolidated latest.json: HTTP ${upRes.status}`);
  }
  return latestJson;
};
export const runManifestCli = async (env = process.env, args = process.argv.slice(2)) => {
  const pkgVersion = JSON.parse(readFileSync('./package.json', 'utf8')).version;
  const repository = env.GITHUB_REPOSITORY;
  const tag = env.RELEASE_TAG ?? `v${pkgVersion}`;
  if (args.includes('--generate')) {
    const platform = args[args.indexOf('--generate') + 1] ?? env.PLATFORM;
    if (!platform) throw new Error('Platform is required for --generate');
    return extractPlatformFragment({ platform, repository, tag });
  }
  if (args.includes('--consolidate')) {
    const dirIdx = args.indexOf('--dir');
    const manifestDir = dirIdx !== -1 ? args[dirIdx + 1] : 'updater-manifests';
    const releaseId = env.RELEASE_ID ? Number(env.RELEASE_ID) : undefined;
    const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
    return await consolidateManifests({ manifestDir, candidateVersion: pkgVersion, repository, releaseId, token });
  }
};
if (process.argv[1]?.endsWith('release-ci-gate-manifest.mjs')) {
  runManifestCli().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
