import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { REQUIRED_PLATFORMS } from './release-ci-gate-assets.mjs';

export const PLATFORM_KEY_MAP = Object.freeze({
  'macos-15': 'darwin-aarch64',
  'macos-15-intel': 'darwin-x86_64',
  'windows-latest': 'windows-x86_64',
});

export const computeRemoteAssetName = (localPath, platformKey) => {
  const localName = basename(localPath);
  if (platformKey === 'darwin-aarch64') {
    if (localName.includes('aarch64') || localName.includes('arm64')) return localName;
    return localName.replace(/\.app\.tar\.gz$/, '_aarch64.app.tar.gz');
  }
  if (platformKey === 'darwin-x86_64') {
    if (localName.includes('x64') || localName.includes('x86_64')) return localName;
    return localName.replace(/\.app\.tar\.gz$/, '_x64.app.tar.gz');
  }
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
  const files = findFiles(targetDir);
  const sigFiles = files.filter((f) => f.endsWith('.sig'));
  let bundlePath = null;
  let sigPath = null;

  for (const s of sigFiles) {
    const candidate = s.slice(0, -4);
    if (!files.includes(candidate)) continue;
    const norm = candidate.replace(/\\/g, '/');

    if (platformKey === 'darwin-aarch64') {
      if (norm.endsWith('.app.tar.gz') && (norm.includes('aarch64') || norm.includes('arm64') || platform === 'macos-15')) {
        bundlePath = candidate; sigPath = s; break;
      }
    } else if (platformKey === 'darwin-x86_64') {
      if (norm.endsWith('.app.tar.gz') && (norm.includes('x64') || norm.includes('x86_64') || platform === 'macos-15-intel') && !norm.includes('aarch64')) {
        bundlePath = candidate; sigPath = s; break;
      }
    } else if (platformKey === 'windows-x86_64') {
      if (norm.endsWith('.exe') || norm.endsWith('.msi') || norm.endsWith('.zip')) {
        bundlePath = candidate; sigPath = s; break;
      }
    }
  }

  if (!bundlePath || !sigPath) {
    throw new Error(`No signed updater artifact found for platform ${platform} in ${targetDir}`);
  }

  const signature = readFileSync(sigPath, 'utf8').trim();
  const remoteFileName = computeRemoteAssetName(bundlePath, platformKey);
  const entry = {
    signature,
    url: `https://github.com/${repository}/releases/download/${tag}/${remoteFileName}`,
  };
  const fragment = { platform: platformKey, entry };
  writeFileSync(`updater-manifest-${platform}.json`, JSON.stringify(fragment, null, 2));
  return fragment;
};

export const consolidateManifests = async ({
  manifestDir = 'updater-manifests', candidateVersion, repository, releaseId,
  token, apiUrl = 'https://api.github.com', fetchImpl = fetch,
}) => {
  const files = findFiles(manifestDir).filter((f) => f.endsWith('.json'));
  const platforms = {};
  for (const f of files) {
    const data = JSON.parse(readFileSync(f, 'utf8'));
    if (data?.platform && data?.entry) {
      if (platforms[data.platform]) {
        throw new Error(`Conflicting duplicate platform fragment for ${data.platform}`);
      }
      platforms[data.platform] = data.entry;
    }
  }
  const missing = REQUIRED_PLATFORMS.filter((p) => !platforms[p]);
  if (missing.length > 0) throw new Error(`Consolidated manifest missing platforms: ${missing.join(', ')}`);

  const ver = candidateVersion.replace(/^v/, '');
  const latestJson = {
    version: ver,
    notes: `SEOmi v${ver}`,
    pub_date: new Date().toISOString(),
    platforms,
  };
  const jsonString = JSON.stringify(latestJson, null, 2);
  writeFileSync('latest.json', jsonString);

  if (releaseId && token && repository) {
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
    const getRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/${releaseId}`, { headers });
    if (!getRes.ok) throw new Error(`Failed to fetch release ${releaseId} during consolidation: HTTP ${getRes.status}`);
    const rel = await getRes.json();
    const existing = (rel.assets ?? []).find((a) => a.name === 'latest.json');
    if (existing) {
      const delRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${existing.id}`, { method: 'DELETE', headers });
      if (!delRes.ok) throw new Error(`Failed to delete existing latest.json asset ${existing.id}: HTTP ${delRes.status}`);
    }
    const uploadUrl = `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=latest.json`;
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
