import { describe, expect, it } from 'vitest';
import {
  expectedManifestFileName,
  validateManifestFragment,
} from '../scripts/release-manifest-validation.mjs';

const version = '0.4.40';
const repository = 'owner/repo';

const fragment = (platform: string, signature = 's1') => ({
  platform,
  entry: {
    signature,
    url: `https://github.com/${repository}/releases/download/v${version}/${expectedManifestFileName(platform, version)}`,
  },
});

describe('release manifest validation', () => {
  it('reconstructs only the canonical role-specific asset names', () => {
    expect(expectedManifestFileName('darwin-aarch64', version)).toBe('SEOmi_0.4.40_aarch64.app.tar.gz');
    expect(expectedManifestFileName('darwin-x86_64', version)).toBe('SEOmi_0.4.40_x64.app.tar.gz');
    expect(expectedManifestFileName('windows-x86_64', version)).toBe('SEOmi_0.4.40_x64-setup.exe');
  });

  it('normalizes a valid fragment and rejects unknown platforms', () => {
    expect(validateManifestFragment(fragment('darwin-aarch64'), { version, repository })).toEqual(fragment('darwin-aarch64'));
    expect(() => validateManifestFragment(fragment('linux-x86_64'), { version, repository })).toThrow('Unknown manifest platform');
  });

  it.each([
    ['wrong origin', 'https://evil.example/owner/repo/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz'],
    ['wrong tag', 'https://github.com/owner/repo/releases/download/v0.4.39/SEOmi_aarch64.app.tar.gz'],
    ['wrong filename', 'https://github.com/owner/repo/releases/download/v0.4.40/SEOmi_x64.app.tar.gz'],
  ])('rejects %s', (_label, url) => {
    expect(() => validateManifestFragment({ ...fragment('darwin-aarch64'), entry: { signature: 's1', url } }, { version, repository })).toThrow('Manifest URL');
  });

  it('accepts the legacy macOS names but rejects stale or deceptive versioned names', () => {
    const legacy = 'https://github.com/owner/repo/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz';
    expect(validateManifestFragment({ ...fragment('darwin-aarch64'), entry: { signature: 's1', url: legacy } }, { version, repository }).entry.url).toBe(legacy);
    for (const fileName of ['SEOmi_0.4.39_aarch64.app.tar.gz', 'other_0.4.40_aarch64.app.tar.gz']) {
      const url = `https://github.com/${repository}/releases/download/v${version}/${fileName}`;
      expect(() => validateManifestFragment({ ...fragment('darwin-aarch64'), entry: { signature: 's1', url } }, { version, repository })).toThrow('Manifest URL');
    }
  });

  it('rejects unsafe or empty signatures and extra fields', () => {
    expect(() => validateManifestFragment(fragment('darwin-aarch64', ' \n'), { version, repository })).toThrow('signature');
    expect(() => validateManifestFragment({ ...fragment('darwin-aarch64'), extra: true }, { version, repository })).toThrow('schema');
  });
});
