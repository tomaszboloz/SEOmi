export const REQUIRED_PLATFORMS = Object.freeze([
  'darwin-aarch64', 'darwin-x86_64', 'windows-x86_64',
]);

const isNonEmpty = (a) => (a?.size ?? 0) > 0 && a?.state !== 'failed';

const assertPlatformRole = (platform, fileName) => {
  const norm = fileName.toLowerCase();
  if (platform === 'darwin-aarch64') {
    if (!norm.endsWith('.app.tar.gz') || (!norm.includes('aarch64') && !norm.includes('arm64')) || norm.includes('x64')) {
      throw new Error(`Platform darwin-aarch64 must reference macOS arm64 bundle (*aarch64*.app.tar.gz), got ${fileName}`);
    }
  } else if (platform === 'darwin-x86_64') {
    if (!norm.endsWith('.app.tar.gz') || (!norm.includes('x64') && !norm.includes('x86_64')) || norm.includes('aarch64') || norm.includes('arm64')) {
      throw new Error(`Platform darwin-x86_64 must reference macOS intel bundle (*x64*.app.tar.gz), got ${fileName}`);
    }
  } else if (platform === 'windows-x86_64') {
    if (norm.endsWith('.app.tar.gz') || norm.endsWith('.dmg') || (!norm.endsWith('.exe') && !norm.endsWith('.msi') && !norm.endsWith('.zip'))) {
      throw new Error(`Platform windows-x86_64 must reference Windows installer or zip bundle, got ${fileName}`);
    }
  }
};

export const validateReleaseAssetsAndPlatforms = (
  release, latestJsonContent, candidateVersion, repository = 'owner/repo',
) => {
  if (!release || typeof release !== 'object') throw new Error('Release payload is invalid.');
  if (!candidateVersion) throw new Error('candidateVersion is required for asset validation.');
  const expectedVer = String(candidateVersion).replace(/^v/, '');
  const expectedTag = `v${expectedVer}`;
  if (release.tag_name !== expectedTag) {
    throw new Error(`Release tag ${release.tag_name} does not match expected candidate tag ${expectedTag}.`);
  }

  const assets = (Array.isArray(release.assets) ? release.assets : []).filter(isNonEmpty);
  const names = assets.map((a) => a.name);
  const assetMap = new Map(assets.map((a) => [a.name, a]));

  const macArmDmg = names.find((n) => n.endsWith('.dmg') && (n.includes('aarch64') || n.includes('arm64')));
  const macArmTar = names.find((n) => n.endsWith('.app.tar.gz') && (n.includes('aarch64') || n.includes('arm64')));
  const macArmSig = macArmTar && assetMap.has(`${macArmTar}.sig`);

  const macIntelDmg = names.find((n) => n.endsWith('.dmg') && (n.includes('x64') || n.includes('x86_64')) && !n.includes('aarch64') && !n.includes('arm64'));
  const macIntelTar = names.find((n) => n.endsWith('.app.tar.gz') && (n.includes('x64') || n.includes('x86_64')) && !n.includes('aarch64') && !n.includes('arm64'));
  const macIntelSig = macIntelTar && assetMap.has(`${macIntelTar}.sig`);

  const winMsi = names.find((n) => n.endsWith('.msi'));
  const winMsiSig = winMsi && assetMap.has(`${winMsi}.sig`);
  const winExe = names.find((n) => n.endsWith('.exe'));
  const winExeSig = winExe && assetMap.has(`${winExe}.sig`);

  const missing = [];
  if (!macArmDmg || !macArmTar || !macArmSig) missing.push('macOS arm64 dmg, tar.gz and paired .sig');
  if (!macIntelDmg || !macIntelTar || !macIntelSig) missing.push('macOS intel dmg, tar.gz and paired .sig');
  if (!winMsi || !winMsiSig) missing.push('Windows x64 msi and paired .sig');
  if (!winExe || !winExeSig) missing.push('Windows x64 exe and paired .sig');
  if (!assetMap.has('latest.json')) missing.push('latest.json');
  if (missing.length > 0) throw new Error(`Release ${release.id} missing required assets: ${missing.join(', ')}`);

  let parsed;
  try {
    parsed = typeof latestJsonContent === 'string' ? JSON.parse(latestJsonContent) : latestJsonContent;
  } catch {
    throw new Error(`Release ${release.id} has invalid latest.json content.`);
  }

  if (parsed?.version !== expectedVer) {
    throw new Error(`latest.json version ${parsed?.version} does not match candidate version ${expectedVer}.`);
  }

  const platforms = parsed?.platforms ?? {};
  const expectedPrefix = `/${repository}/releases/download/${expectedTag}/`;
  const resolvedFiles = [];

  for (const p of REQUIRED_PLATFORMS) {
    const entry = platforms[p];
    if (!entry || !entry.url || typeof entry.signature !== 'string' || !entry.signature.trim()) {
      throw new Error(`Release ${release.id} latest.json missing platform or signature: ${p}`);
    }
    let u;
    try {
      u = new URL(entry.url);
    } catch {
      throw new Error(`Platform ${p} url is invalid: ${entry.url}`);
    }
    if (u.protocol !== 'https:' || u.hostname !== 'github.com') {
      throw new Error(`Platform ${p} url host ${u.hostname} is not allowed; must be github.com`);
    }
    if (!u.pathname.startsWith(expectedPrefix)) {
      throw new Error(`Platform ${p} url ${entry.url} is not bound to ${expectedPrefix}`);
    }
    const fileName = decodeURIComponent(u.pathname.slice(expectedPrefix.length));
    if (!fileName || fileName.includes('/')) {
      throw new Error(`Platform ${p} url contains invalid file name: ${fileName}`);
    }
    assertPlatformRole(p, fileName);
    if (!assetMap.has(fileName)) {
      throw new Error(`Platform ${p} references asset ${fileName} not found in release ${release.id}.`);
    }
    if (!assetMap.has(`${fileName}.sig`)) {
      throw new Error(`Platform ${p} updater asset ${fileName} is missing paired signature ${fileName}.sig.`);
    }
    resolvedFiles.push(fileName);
  }

  if (new Set(resolvedFiles).size !== REQUIRED_PLATFORMS.length) {
    throw new Error(`Platforms must reference distinct release artifacts, got duplicates: [${resolvedFiles.join(', ')}]`);
  }
  return { valid: true, platforms: Object.keys(platforms) };
};

export { createOrGetDraftRelease, verifyAndPublishDraftRelease } from './release-ci-gate-publish.mjs';
