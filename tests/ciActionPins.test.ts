import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflows = [
  readFileSync('.github/workflows/test.yml', 'utf8'),
  readFileSync('.github/workflows/release.yml', 'utf8'),
].join('\n');

const expectedActions = {
  'actions/checkout': ['3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1', 10],
  'actions/setup-node': ['949feb2413d6458794dcd2491c4babbbce0c15c1', 'v7.1.0', 9],
  'actions/cache': ['55cc8345863c7cc4c66a329aec7e433d2d1c52a9', 'v6.1.0', 2],
  'actions/upload-artifact': ['cf430e030ddbb5b0abf93d22962f4752f3646cd9', 'v7.0.2', 6],
  'actions/download-artifact': ['9000827ccba6bdab643e8b6fd33ac0654aef8333', 'v8.0.2', 2],
  'dtolnay/rust-toolchain': ['b725eda525362e7cf34af9a7243cac1e3f01a7ec', 'stable', 5],
  'taiki-e/install-action': ['1e29709c0ec63babbe8f266397a465f29a825f91', 'v2.87.31', 2],
  'tauri-apps/tauri-action': ['1deb371b0cd8bd54025b384f1cd735e725c4060f', 'action-v1.0.0', 1],
} as const;

describe('CI dependency pin contracts', () => {
  it('keeps every action on the verified latest stable immutable ref', () => {
    for (const [action, [sha, tag, count]] of Object.entries(expectedActions)) {
      const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = [...workflows.matchAll(new RegExp(`uses: ${escaped}@([0-9a-f]{40}) # ([^\\r\\n]+)`, 'g'))];
      expect(matches, `${action} occurrences`).toHaveLength(count);
      expect(matches.map((match) => match[1]), `${action} SHA`).toEqual(Array(count).fill(sha));
      expect(matches.map((match) => match[2]), `${action} release`).toEqual(Array(count).fill(tag));
    }
    expect(workflows).not.toMatch(/uses:\s+[^\s@]+@(?:main|master|v\d+(?:\.\d+)?)(?:\s|$)/);
  });

  it('keeps coverage and SBOM tools on compatibility-tested versions', () => {
    expect(workflows).toContain('tool: cargo-llvm-cov@0.9.1');
    expect(workflows).toContain(
      'npx --yes @cyclonedx/cyclonedx-npm@6.0.1 --spec-version 1.6',
    );
    expect(workflows).toContain('cargo install cargo-cyclonedx --version 0.5.9 --locked');
    expect(workflows).toContain('cargo install cargo-audit --locked');
  });
});
