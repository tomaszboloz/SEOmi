import { validateReleaseVersion } from './release-input-validation.mjs';

/** Current packaging versions updater archives; retain earlier unversioned names. */
export const resolveProvenanceArtifacts = (assets, version) => {
  const ver = validateReleaseVersion(version);
  if (!Array.isArray(assets)) throw new Error('Release assets must be an array');
  const names = new Set(assets.map(asset => asset?.name));
  const macArchive = arch => {
    const versioned = `SEOmi_${ver}_${arch}.app.tar.gz`;
    return names.has(versioned) ? versioned : `SEOmi_${arch}.app.tar.gz`;
  };
  const subjects = [
    [macArchive('aarch64'), 'darwin-aarch64-app'],
    [macArchive('x64'), 'darwin-x86_64-app'],
    [`SEOmi_${ver}_x64-setup.exe`, 'windows-x86_64-setup'],
    [`SEOmi_${ver}_x64_en-US.msi`, 'windows-x86_64-msi'],
    ['latest.json', 'manifest'],
    [`SEOmi_${ver}_aarch64.dmg`, 'darwin-aarch64-dmg'],
    [`SEOmi_${ver}_x64.dmg`, 'darwin-x86_64-dmg'],
  ];
  for (const [name] of subjects) {
    if (!names.has(name)) throw new Error(`Missing release asset ${name}`);
  }
  return subjects.map(([name, role]) => ({ name, role }));
};
