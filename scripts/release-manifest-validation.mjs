import {
  validateReleaseTag,
  validateReleaseVersion,
  validateRepository,
} from './release-input-validation.mjs';

export const MANIFEST_PLATFORMS = Object.freeze([
  'darwin-aarch64', 'darwin-x86_64', 'windows-x86_64',
]);

const expectedFileNames = (platform, version) => {
  if (platform === 'darwin-aarch64') return ['SEOmi_aarch64.app.tar.gz'];
  if (platform === 'darwin-x86_64') return ['SEOmi_x64.app.tar.gz'];
  if (platform === 'windows-x86_64') return [`SEOmi_${version}_x64-setup.exe`, `SEOmi_${version}_x64_en-US.msi`];
  throw new Error(`Unknown manifest platform: ${platform}`);
};

export const expectedManifestFileNames = (platform, version) => {
  const validVersion = validateReleaseVersion(version);
  if (!MANIFEST_PLATFORMS.includes(platform)) throw new Error(`Unknown manifest platform: ${platform}`);
  return expectedFileNames(platform, validVersion);
};
export const expectedManifestFileName = (platform, version) => expectedManifestFileNames(platform, version)[0];

const validateSignature = (signature) => {
  if (typeof signature !== 'string' || !signature.trim() || signature.length > 4096 || /[\u0000-\u001f\u007f]/.test(signature)) {
    throw new Error('Manifest signature is invalid');
  }
  return signature;
};

const repositoryFromUrl = (url) => {
  const match = new URL(url).pathname.match(/^\/([^/]+\/[^/]+)\/releases\/download\//);
  if (!match) throw new Error(`Manifest URL has invalid release path: ${url}`);
  return validateRepository(match[1]);
};

export const validateManifestFragment = (fragment, { version, repository } = {}) => {
  const validVersion = validateReleaseVersion(version);
  const expectedRepository = repository === undefined ? undefined : validateRepository(repository);
  if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment) || Object.keys(fragment).sort().join() !== 'entry,platform') {
    throw new Error('Manifest fragment schema is invalid');
  }
  const { platform, entry } = fragment;
  if (!MANIFEST_PLATFORMS.includes(platform)) throw new Error(`Unknown manifest platform: ${platform}`);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).sort().join() !== 'signature,url') {
    throw new Error(`Manifest entry for ${platform} is invalid`);
  }
  const signature = validateSignature(entry.signature);
  const fileNames = expectedManifestFileNames(platform, validVersion);
  const tag = validateReleaseTag(`v${validVersion}`);
  const repo = expectedRepository ?? repositoryFromUrl(entry.url);
  const expectedUrls = fileNames.map((fileName) => `https://github.com/${repo}/releases/download/${tag}/${fileName}`);
  if (!expectedUrls.includes(entry.url)) throw new Error(`Manifest URL for ${platform} is invalid`);
  return { platform, entry: { signature, url: entry.url } };
};

export const manifestRepository = (fragment) => repositoryFromUrl(fragment.entry.url);
