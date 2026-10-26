import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { runReleaseGateTagCli } from '../scripts/release-ci-gate-tag.mjs';
import { createPackageFixture, shaA, shaB } from './releaseCiGateCliHelpers.js';

const release = readFileSync('.github/workflows/release.yml', 'utf8');
const dispatcher = () => readFileSync('.github/workflows/release-after-ci.yml', 'utf8');
const bash = process.platform === 'win32'
  ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe') : '/bin/bash';
const runScript = (workflow: string) => {
  const block = workflow.replace(/\r\n/g, '\n').split('        run: |\n')[1];
  if (!block) throw new Error('Missing Bash run block');
  return block.split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
};

function runDispatch({ branch = 'main', sha = shaA, current = shaA, apiExit = '0', dispatchExit = '0', newline = '\n' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'release-dispatch-'));
  try {
    const calls = join(dir, 'calls.jsonl'), fakeGh = join(dir, 'gh');
    writeFileSync(fakeGh, `
const fs = require('node:fs');
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[2] === 'api') { console.log(process.env.TEST_CURRENT); process.exit(Number(process.env.TEST_API_EXIT)); }
process.exit(Number(process.env.TEST_DISPATCH_EXIT));
`);
    const script = runScript(dispatcher().replace(/\r?\n/g, newline));
    const result = spawnSync(bash, ['-c', 'gh() { "$TEST_NODE" "$TEST_GH" "$@"; }\n' + script], { encoding: 'utf8', env: {
      ...process.env, TEST_NODE: process.execPath, TEST_GH: fakeGh, SOURCE_BRANCH: branch, SOURCE_SHA: sha,
      GITHUB_REPOSITORY: 'owner/repo', TEST_CALLS: calls, TEST_CURRENT: current,
      TEST_API_EXIT: apiExit, TEST_DISPATCH_EXIT: dispatchExit,
    } });
    let commands: string[][] = [];
    try { commands = readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); } catch { /* No GH calls before validation. */ }
    return { status: result.status, commands, stdout: result.stdout };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

describe('release scheduling after complete CI', () => {
  it('starts automatic release only after successful trusted push CI and preserves manual/tag triggers', () => {
    const workflow = dispatcher();
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain("workflows: ['Test Suite & Security Audit']");
    expect(workflow).toContain('types: [completed]');
    expect(workflow).toContain("branches: [ main, 'release/**' ]");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
    expect(workflow).toContain('actions: write');
    expect(workflow).not.toContain('actions/checkout');
    expect(release.split('concurrency:')[0]).not.toContain('branches:');
    expect(release).toContain('workflow_dispatch:');
    expect(release).toContain('expected_sha:');
    expect(release).toContain("- 'v*'");
    expect(release).toContain('RELEASE_EXPECTED_SHA: ${{ inputs.expected_sha }}');
    expect(readFileSync('.github/workflows/test.yml', 'utf8')).toMatch(/run: npm test -- tests\/releaseScheduling\.test\.ts\s+- name: Run full frontend test suite/);
  });

  it.each(['release-preflight', 'publish-release'])('allows %s to read actual CodeQL evidence', job => {
    const permissions = release.split(`  ${job}:`)[1].split('    steps:')[0];
    expect(permissions).toContain('security-events: read');
    expect(permissions).toContain('checks: read');
    expect(permissions).not.toMatch(/security-events: write|write-all/);
  });

  it.each(['main', 'release/0.4.41'])('dispatches the exact successful SHA from %s', branch => {
    const result = runDispatch({ branch });
    expect(result.status).toBe(0);
    expect(result.commands).toEqual([
      ['api', `repos/owner/repo/git/ref/heads/${branch}`, '--jq', '.object.sha'],
      ['workflow', 'run', 'release.yml', '--repo', 'owner/repo', '--ref', branch, '-f', `expected_sha=${shaA}`],
    ]);
  });

  it('does not dispatch stale successful CI when the branch has advanced', () => {
    const result = runDispatch({ current: shaB });
    expect(result.status).toBe(0);
    expect(result.commands).toHaveLength(1);
    expect(result.stdout).toContain('Branch advanced');
  });

  it.each(['', 'null', 'invalid'])('fails on malformed branch API response %j', current => {
    const result = runDispatch({ current });
    expect(result.status).not.toBe(0);
    expect(result.commands).toHaveLength(1);
  });

  it.each(['\n', '\r\n'])('executes actual dispatch Bash from YAML with %j line endings', newline => {
    const result = runDispatch({ newline });
    expect(result.status).toBe(0);
    expect(result.commands.at(-1)?.at(-1)).toBe(`expected_sha=${shaA}`);
  });

  it.each(['\n', '\r\n'])('rejects a dispatch race before shell reads with %j line endings', newline => {
    const script = runScript(release.split('      - name: Check updater signing credentials')[0].replace(/\r?\n/g, newline));
    const noRead = 'node() { echo forbidden-read >&2; exit 99; }; git() { echo forbidden-read >&2; exit 99; };\n';
    const result = spawnSync(bash, ['-c', noRead + script], { encoding: 'utf8',
      env: { ...process.env, RELEASE_EXPECTED_SHA: shaB, RELEASE_COMMIT_SHA: shaA } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Expected CI commit does not match release SHA');
    expect(result.stderr).not.toContain('forbidden-read');
  });

  it.each(['feature/test', 'release/../main', 'release/bad?ref=x'])('rejects unsafe branch %s before any API call', branch => {
    const result = runDispatch({ branch });
    expect(result.status).not.toBe(0);
    expect(result.commands).toEqual([]);
  });

  it.each(['', 'invalid', `${shaA}\ninjected`])('rejects malformed source SHA %j', sha => {
    const result = runDispatch({ sha });
    expect(result.status).not.toBe(0);
    expect(result.commands).toEqual([]);
  });

  it('does not dispatch after a failed branch lookup and surfaces dispatch failure', () => {
    const lookup = runDispatch({ apiExit: '1' });
    expect(lookup.status).not.toBe(0);
    expect(lookup.commands).toHaveLength(1);
    expect(runDispatch({ dispatchExit: '1' }).status).not.toBe(0);
  });

  it.each([shaB, 'invalid'])('blocks a dispatch/build SHA mismatch before any release request (%s)', async expected => {
    const fixture = createPackageFixture('0.4.41'), fetchImpl = vi.fn();
    try {
      await expect(runReleaseGateTagCli({ RELEASE_EXPECTED_SHA: expected, RELEASE_COMMIT_SHA: shaA },
        ['--preflight'], fetchImpl, fixture.pkgPath)).rejects.toThrow('Expected CI commit does not match release SHA');
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { fixture.cleanup(); }
  });

  it.each([shaA, '', undefined])('preserves matching dispatch and ordinary manual preflight (%s)', async expected => {
    const fixture = createPackageFixture('0.4.41');
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 404 }));
    try {
      await expect(runReleaseGateTagCli({ RELEASE_EXPECTED_SHA: expected, RELEASE_COMMIT_SHA: shaA,
        GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'test' }, ['--preflight'], fetchImpl, fixture.pkgPath))
        .resolves.toEqual({ tag: 'v0.4.41', publish: true });
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally { fixture.cleanup(); }
  });
});
