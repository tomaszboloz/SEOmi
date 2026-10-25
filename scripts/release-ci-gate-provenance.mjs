import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute } from 'node:path';
import { isPathWithin } from './release-artifact-paths.mjs';
import { readReleaseFile, writeReleaseFileAtomically } from './release-atomic-file.mjs';
import { validateGitHubReleaseContext, validateReleaseTag } from './release-input-validation.mjs';
import { uploadReleaseAsset, fetchOrVerifyAsset } from './release-ci-gate-provenance-upload.mjs';
const ALLOWED_EXT = ['.dmg', '.tar.gz', '.exe', '.msi', '.json', '.txt'];
const REQUIRED_ROLES = ['darwin-aarch64-app', 'darwin-x86_64-app', 'windows-x86_64-setup', 'windows-x86_64-msi', 'manifest'];

export const computeFileSha256 = (filePath, artifactDir = dirname(filePath)) => createHash('sha256').update(readReleaseFile(filePath, artifactDir)).digest('hex');

export const generateArtifactChecksums = ({ artifactDir, files, outputPath }) => {
  if (!Array.isArray(files) || files.length === 0) throw new Error('files must be a non-empty array.');
  const lines = [], seen = new Set(), realDir = artifactDir ? realpathSync(artifactDir) : null;
  for (const file of files) {
    if (file.includes('..') || (artifactDir && isAbsolute(file))) throw new Error(`Path traversal rejected: ${file}`);
    const fullPath = artifactDir ? `${artifactDir}/${file}` : file;
    if (!existsSync(fullPath)) throw new Error(`Artifact file does not exist: ${file}`);
    if (realDir && !isPathWithin(realDir, realpathSync(fullPath))) {
      throw new Error(`Symlink escape detected: ${file}`);
    }
    const bytes = readReleaseFile(fullPath, realDir ?? dirname(fullPath));
    if (bytes.length === 0) throw new Error(`Artifact file is empty: ${file}`);
    const name = basename(file);
    if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) throw new Error(`File extension not allowed: ${name}`);
    if (seen.has(name)) throw new Error(`Duplicate checksum subject detected: ${name}`);
    seen.add(name);
    lines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  }
  const content = `${lines.join('\n')}\n`;
  if (outputPath) writeReleaseFileAtomically(outputPath, content);
  return content;
};
export const buildProvenanceInventory = ({ repository, tag, commitSha, version, artifacts, sboms }) => {
  if (!repository || !tag || !commitSha || !version) throw new Error('repository, tag, commitSha and version are required.');
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) throw new Error(`Invalid commit SHA format: ${commitSha}`);
  if (!Array.isArray(artifacts) || artifacts.length === 0) throw new Error('artifacts must be a non-empty array.');
  const seenNames = new Set(), presentRoles = new Set(), subjects = [];
  for (const art of artifacts) {
    if (!art?.name || !art?.sha256 || !art?.size || !art?.role) throw new Error(`Invalid artifact entry: ${JSON.stringify(art)}`);
    if (!/^[0-9a-f]{64}$/i.test(art.sha256)) throw new Error(`Invalid sha256 for ${art.name}: ${art.sha256}`);
    if (seenNames.has(art.name)) throw new Error(`Duplicate artifact subject detected: ${art.name}`);
    seenNames.add(art.name);
    presentRoles.add(art.role);
    subjects.push({ name: art.name, sha256: art.sha256.toLowerCase(), size: art.size, role: art.role });
  }
  for (const req of REQUIRED_ROLES) {
    if (!presentRoles.has(req)) throw new Error(`Incomplete platform artifacts: missing required role ${req}`);
  }
  return {
    schemaVersion: '1.0.0', repository, tag, commitSha: commitSha.toLowerCase(),
    version: version.replace(/^v/, ''), createdAt: new Date().toISOString(),
    subjects, sboms: Array.isArray(sboms) ? sboms : [],
  };
};

export const validateProvenanceContract = ({ inventory, checksumsContent, sbomNode, sbomRust, expectedSha, expectedVersion, artifactDir }) => {
  if (inventory.commitSha !== expectedSha.toLowerCase()) throw new Error(`commitSha mismatch: ${inventory.commitSha} vs ${expectedSha}`);
  if (inventory.version !== expectedVersion.replace(/^v/, '')) throw new Error(`version mismatch: ${inventory.version} vs ${expectedVersion}`);
  const checksumMap = new Map();
  for (const line of checksumsContent.trim().split('\n')) {
    const [sha, name] = line.trim().split(/\s+/);
    if (sha && name) checksumMap.set(name, sha.toLowerCase());
  }
  for (const subj of inventory.subjects) {
    const expectedHash = checksumMap.get(subj.name);
    if (!expectedHash || expectedHash !== subj.sha256) throw new Error(`Checksum mismatch for ${subj.name}`);
    if (artifactDir) {
      const fullPath = `${artifactDir}/${subj.name}`;
      if (!existsSync(fullPath) || readReleaseFile(fullPath, artifactDir).length !== subj.size || computeFileSha256(fullPath, artifactDir) !== subj.sha256) return false;
    }
  }
  if (!Array.isArray(sbomNode?.components) || sbomNode?.bomFormat !== 'CycloneDX') {
    throw new Error('Invalid Node CycloneDX SBOM structure: components must be an array.');
  }
  if (!Array.isArray(sbomRust?.components) || sbomRust?.bomFormat !== 'CycloneDX') {
    throw new Error('Invalid Rust CycloneDX SBOM structure: components must be an array.');
  }
  return true;
};

export const prepareReleaseProvenance = async ({
  apiUrl = 'https://api.github.com', uploadUrl = 'https://uploads.github.com',
  repository = process.env.GITHUB_REPOSITORY, releaseId = process.env.RELEASE_ID,
  commitSha = process.env.RELEASE_COMMIT_SHA, tag = process.env.RELEASE_TAG,
  token = process.env.GITHUB_TOKEN, artifactDir = '.', fetchImpl = fetch,
}) => {
  if (!repository || !releaseId || !token || !commitSha || !tag) throw new Error('Missing required release environment.');
  ({ apiUrl, uploadUrl, repository, releaseId } = validateGitHubReleaseContext({ apiUrl, uploadUrl, repository, releaseId })); tag = validateReleaseTag(tag);
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) throw new Error(`Invalid commit SHA format: ${commitSha}`);
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const getRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/${releaseId}`, { headers });
  if (!getRes.ok) throw new Error(`Failed to fetch release ${releaseId}: HTTP ${getRes.status}`);
  const release = await getRes.json();
  if (Number(release?.id) !== Number(releaseId)) throw new Error(`Release ID mismatch: ${release?.id} vs ${releaseId}`);
  if (!release.draft) throw new Error(`Refusing non-draft release ${releaseId}: must be draft.`);
  if (release.tag_name !== tag) throw new Error(`Release tag mismatch: ${release.tag_name} vs ${tag}`);
  if (release.target_commitish !== commitSha) throw new Error(`Release target_commitish mismatch: ${release.target_commitish} vs ${commitSha}`);

  const seenRemote = new Set(), verified = new Map();
  for (const a of release.assets ?? []) {
    if (seenRemote.has(a.name)) throw new Error(`Duplicate remote release asset name detected: ${a.name}`);
    seenRemote.add(a.name);
  }

  const ver = tag.replace(/^v/, ''), realDir = realpathSync(artifactDir);
  const required = [
    'SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${ver}_x64-setup.exe`,
    `SEOmi_${ver}_x64_en-US.msi`, 'latest.json', `SEOmi_${ver}_aarch64.dmg`, `SEOmi_${ver}_x64.dmg`,
  ];
  for (const name of required) {
    const asset = (release.assets ?? []).find((a) => a.name === name);
    if (!asset) throw new Error(`Missing release asset ${name} in draft release ${releaseId}`);
    verified.set(name, await fetchOrVerifyAsset({ asset, name, artifactDir, realDir, headers, apiUrl, repository, fetchImpl }));
  }

  const nodePath = `${artifactDir}/sbom-node.json`;
  const rustPath = existsSync(`${artifactDir}/sbom-rust.json`) ? `${artifactDir}/sbom-rust.json` : `${artifactDir}/src-tauri/sbom-rust.json`;
  if (!existsSync(nodePath)) throw new Error('Missing required Node CycloneDX SBOM: sbom-node.json');
  if (!existsSync(rustPath)) throw new Error('Missing required Rust CycloneDX SBOM: sbom-rust.json');
  const nodeBytes = readReleaseFile(nodePath, realDir), rustBytes = readReleaseFile(rustPath, realDir);
  const sbomNode = JSON.parse(nodeBytes.toString('utf8')), sbomRust = JSON.parse(rustBytes.toString('utf8'));
  const checksums = generateArtifactChecksums({ artifactDir, files: required, outputPath: `${artifactDir}/SHA256SUMS.txt` });
  const roleMap = {
    'SEOmi_aarch64.app.tar.gz': 'darwin-aarch64-app', 'SEOmi_x64.app.tar.gz': 'darwin-x86_64-app',
    [`SEOmi_${ver}_x64-setup.exe`]: 'windows-x86_64-setup', [`SEOmi_${ver}_x64_en-US.msi`]: 'windows-x86_64-msi',
    'latest.json': 'manifest', [`SEOmi_${ver}_aarch64.dmg`]: 'darwin-aarch64-dmg', [`SEOmi_${ver}_x64.dmg`]: 'darwin-x86_64-dmg',
  };
  const artifacts = required.map((name) => ({ name, role: roleMap[name], ...verified.get(name) }));
  const sboms = [
    { name: 'sbom-node.json', sha256: createHash('sha256').update(nodeBytes).digest('hex'), format: 'CycloneDX', target: 'npm' },
    { name: 'sbom-rust.json', sha256: createHash('sha256').update(rustBytes).digest('hex'), format: 'CycloneDX', target: 'cargo' },
  ];
  const inventory = buildProvenanceInventory({ repository, tag, commitSha, version: ver, artifacts, sboms });
  const valid = validateProvenanceContract({ inventory, checksumsContent: checksums, sbomNode, sbomRust, expectedSha: commitSha, expectedVersion: ver, artifactDir });
  if (!valid) throw new Error('Provenance contract validation failed');

  writeReleaseFileAtomically(`${artifactDir}/release-provenance.json`, JSON.stringify(inventory, null, 2));
  const uploadOpts = { uploadUrl, apiUrl, repository, releaseId, token, fetchImpl, existingAssets: release.assets };
  await uploadReleaseAsset({ ...uploadOpts, name: 'sbom-node.json', content: nodeBytes, contentType: 'application/json' });
  await uploadReleaseAsset({ ...uploadOpts, name: 'sbom-rust.json', content: rustBytes, contentType: 'application/json' });
  await uploadReleaseAsset({ ...uploadOpts, name: 'SHA256SUMS.txt', content: checksums, contentType: 'text/plain' });
  await uploadReleaseAsset({ ...uploadOpts, name: 'release-provenance.json', content: JSON.stringify(inventory, null, 2), contentType: 'application/json' });
  return { checksums, inventory };
};

if (process.argv.includes('--prepare-provenance')) {
  await prepareReleaseProvenance({}).catch((e) => { console.error(e); process.exit(1); });
}
