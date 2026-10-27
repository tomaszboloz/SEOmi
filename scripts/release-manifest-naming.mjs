import { basename } from 'node:path';
import { validateReleaseVersion } from './release-input-validation.mjs';

const MAC_ARCHITECTURES = Object.freeze({
  'darwin-aarch64': { canonical: 'aarch64', aliases: ['arm64'] },
  'darwin-x86_64': { canonical: 'x64', aliases: ['x86_64'] },
});

const macArchitecture = (platform) => {
  const architecture = MAC_ARCHITECTURES[platform];
  if (!architecture) throw new Error(`Unknown macOS manifest platform: ${platform}`);
  return architecture;
};

const versionedMacName = (version, architecture) => `SEOmi_${version}_${architecture}.app.tar.gz`;

export const macManifestFileNames = (platform, version) => {
  const validVersion = validateReleaseVersion(version);
  const { canonical } = macArchitecture(platform);
  return [versionedMacName(validVersion, canonical), `SEOmi_${canonical}.app.tar.gz`];
};

export const macLocalBundleFileNames = (platform, version) => {
  const validVersion = validateReleaseVersion(version);
  const { aliases } = macArchitecture(platform);
  return [...new Set([
    ...macManifestFileNames(platform, validVersion),
    ...aliases.map((architecture) => versionedMacName(validVersion, architecture)),
    ...aliases.map((architecture) => `SEOmi_${architecture}.app.tar.gz`),
    'SEOmi.app.tar.gz',
  ])];
};

const pathMatchesArchitecture = (path, platform) => {
  const norm = path.replace(/\\/g, '/');
  const armPath = /(?:^|\/(?:target|release)\/)(?:aarch64|arm64)-apple-darwin(?:\/|$)/i.test(norm);
  const intelPath = /(?:^|\/(?:target|release)\/)(?:x86_64|x64)-apple-darwin(?:\/|$)/i.test(norm);
  if (!armPath && !intelPath) return true;
  return platform === 'darwin-aarch64' ? armPath && !intelPath : intelPath && !armPath;
};

export const selectSignedMacBundle = ({ files, sigFiles, platform, version }) => {
  const localNames = macLocalBundleFileNames(platform, version);
  for (const localName of localNames) {
    const signaturePath = sigFiles.find((candidateSignature) => {
      const candidate = candidateSignature.slice(0, -4);
      return basename(candidate) === localName
        && files.includes(candidate)
        && pathMatchesArchitecture(candidate, platform);
    });
    if (signaturePath) return { bundlePath: signaturePath.slice(0, -4), sigPath: signaturePath };
  }
  return null;
};

export const remoteMacAssetName = (localPath, platform, version) => {
  const validVersion = validateReleaseVersion(version);
  const localName = basename(localPath);
  if (!macLocalBundleFileNames(platform, validVersion).includes(localName)) {
    throw new Error(`Unexpected macOS updater artifact for ${platform}: ${localName}`);
  }
  return macManifestFileNames(platform, validVersion)[0];
};
