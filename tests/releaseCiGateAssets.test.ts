import { describe, expect, it } from 'vitest';
import {
  validateReleaseAssetsAndPlatforms,
} from '../scripts/release-ci-gate-assets.mjs';

const fullAssets = [
  { id: 1, name: 'SEOmi_0.4.40_aarch64.dmg', size: 1000 },
  { id: 2, name: 'SEOmi_0.4.40_aarch64.app.tar.gz', size: 2000 },
  { id: 3, name: 'SEOmi_0.4.40_aarch64.app.tar.gz.sig', size: 50 },
  { id: 4, name: 'SEOmi_0.4.40_x64.dmg', size: 1000 },
  { id: 5, name: 'SEOmi_0.4.40_x64.app.tar.gz', size: 2000 },
  { id: 6, name: 'SEOmi_0.4.40_x64.app.tar.gz.sig', size: 50 },
  { id: 7, name: 'SEOmi_0.4.40_x64_en-US.msi', size: 3000 },
  { id: 8, name: 'SEOmi_0.4.40_x64_en-US.msi.sig', size: 50 },
  { id: 9, name: 'SEOmi_0.4.40_x64-setup.exe', size: 3000 },
  { id: 10, name: 'SEOmi_0.4.40_x64-setup.exe.sig', size: 50 },
  { id: 11, name: 'latest.json', size: 500 },
];
const fullLatestJson = {
  version: '0.4.40',
  platforms: {
    'darwin-aarch64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_aarch64.app.tar.gz', signature: 'sig1' },
    'darwin-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64.app.tar.gz', signature: 'sig2' },
    'windows-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe', signature: 'sig3' },
  },
};

describe('release assets and 3-platform updater validator', () => {
  it('rejects manifest where all 3 platforms download the same Windows EXE', () => {
    const allWinExe = {
      version: '0.4.40',
      platforms: {
        'darwin-aarch64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe', signature: 'sig' },
        'darwin-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe', signature: 'sig' },
        'windows-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe', signature: 'sig' },
      },
    };
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: fullAssets }, allWinExe, '0.4.40', 'o/r'))
      .toThrow('Platform darwin-aarch64 must reference macOS arm64 bundle');
  });

  it('rejects swapped macOS ARM and Intel bundles', () => {
    const swapped = {
      version: '0.4.40',
      platforms: {
        'darwin-aarch64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64.app.tar.gz', signature: 'sig' },
        'darwin-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_aarch64.app.tar.gz', signature: 'sig' },
        'windows-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe', signature: 'sig' },
      },
    };
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: fullAssets }, swapped, '0.4.40', 'o/r'))
      .toThrow('Platform darwin-aarch64 must reference macOS arm64 bundle');
  });

  it('rejects zero-sized placeholders and missing Windows signatures', () => {
    const placeholders = [
      { id: 1, name: 'fake-aarch64.txt', size: 0 }, { id: 2, name: 'fake.exe', size: 0 }, { id: 3, name: 'latest.json', size: 0 },
    ];
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: placeholders }, fullLatestJson, '0.4.40', 'o/r'))
      .toThrow('missing required assets');
    const noWinSigs = fullAssets.filter((a) => !a.name.endsWith('.msi.sig') && !a.name.endsWith('.exe.sig'));
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: noWinSigs }, fullLatestJson, '0.4.40', 'o/r'))
      .toThrow('missing required assets: Windows x64');
  });

  it('rejects wrong versions, foreign URLs and non-asset URLs', () => {
    const wrongVersion = { ...fullLatestJson, version: '0.4.9' };
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: fullAssets }, wrongVersion, '0.4.40', 'o/r'))
      .toThrow('latest.json version 0.4.9 does not match candidate version 0.4.40');
    const foreignUrl = {
      ...fullLatestJson,
      platforms: { ...fullLatestJson.platforms, 'darwin-aarch64': { url: 'https://evil.example.com/v0.4.40/arm.tar.gz', signature: 's' } },
    };
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: fullAssets }, foreignUrl, '0.4.40', 'o/r'))
      .toThrow('url host evil.example.com is not allowed; must be github.com');
    const nonAssetUrl = {
      ...fullLatestJson,
      platforms: { ...fullLatestJson.platforms, 'darwin-aarch64': { url: 'https://github.com/o/r/releases/download/v0.4.40/nonexistent_aarch64.app.tar.gz', signature: 's' } },
    };
    expect(() => validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: fullAssets }, nonAssetUrl, '0.4.40', 'o/r'))
      .toThrow('references asset nonexistent_aarch64.app.tar.gz not found in release');
  });

  it('validates 3 complete platform sets on happy path', () => {
    const res = validateReleaseAssetsAndPlatforms({ id: 1, tag_name: 'v0.4.40', assets: fullAssets }, fullLatestJson, '0.4.40', 'o/r');
    expect(res.valid).toBe(true);
    expect(res.platforms).toEqual(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64']);
  });
});
