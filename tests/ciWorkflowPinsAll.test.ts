import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowDir = '.github/workflows';
const workflowFiles = readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));
const read = (name: string) => readFileSync(join(workflowDir, name), 'utf8').replace(/\r\n/g, '\n');

// A remote action is immutable only when it names a full 40-char commit SHA.
// The trailing comment records the human-readable release so Dependabot and
// reviewers can see which tag the SHA was resolved from.
const pinned = /^(?:- )?uses: [A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40} # \S+$/;
const local = /^(?:- )?uses: \.\/[A-Za-z0-9_./-]+$/;

function usesLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:- )?uses:/.test(line));
}

function unpinnedUses(text: string): string[] {
  return usesLines(text).filter((line) => !pinned.test(line) && !local.test(line));
}

describe('every workflow pins its actions to commit SHAs', () => {
  it('finds the workflow files to scan', () => {
    expect(workflowFiles).toEqual(
      expect.arrayContaining(['test.yml', 'release.yml', 'release-after-ci.yml']),
    );
  });

  it.each(workflowFiles)('%s uses only SHA-pinned or local actions', (name) => {
    expect(unpinnedUses(read(name))).toEqual([]);
  });

  it.each(workflowFiles)('%s declares a top-level read-only token default', (name) => {
    const text = read(name);
    const top = text.split('\njobs:\n')[0];
    expect(top).toMatch(/\npermissions:\n {2}contents: read\n/);
  });

  it('rejects tag, branch, short-SHA, docker and comment-less references', () => {
    const bad = [
      'uses: actions/checkout@v4',
      '- uses: actions/checkout@main',
      'uses: actions/checkout@3d3c42e',
      'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      'uses: docker://alpine:3.20',
      'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1x # v7',
    ];
    for (const line of bad) expect(unpinnedUses(line), line).toEqual([line.trim()]);
  });

  it('accepts a full SHA with a release comment and local actions', () => {
    const good = [
      '- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
      'uses: github/codeql-action/init@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4.0.0',
      'uses: ./.github/actions/setup',
    ];
    expect(unpinnedUses(good.join('\n'))).toEqual([]);
  });
});
