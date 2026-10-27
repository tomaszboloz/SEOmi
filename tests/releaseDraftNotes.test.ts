import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { runReleaseGateTagCli } from '../scripts/release-ci-gate-tag.mjs';
import { createPackageFixture, shaA } from './releaseCiGateCliHelpers.js';

it('includes the verified multiline notes when creating the shared release draft', async () => {
  const fixture = createPackageFixture('0.4.42');
  const notes = '## Fixed\n- Settings load in the native application.\n\n## Thanks\n- @RafalSzy\n';
  const fetchImpl = vi.fn<typeof fetch>(async (_url, options) => {
    if (options?.method === 'POST') return new Response('{"id":123}', { status: 201 });
    return new Response('[]', { status: 200 });
  });
  try {
    await runReleaseGateTagCli({
      GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 'fixture', RELEASE_COMMIT_SHA: shaA,
      RELEASE_TAG: 'v0.4.42', RELEASE_BODY: notes,
    }, ['--create-draft'], fetchImpl, fixture.pkgPath);
    const created = fetchImpl.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(JSON.parse(String(created?.[1]?.body))).toMatchObject({
      tag_name: 'v0.4.42', target_commitish: shaA, draft: true, prerelease: false, body: notes,
    });
  } finally { fixture.cleanup(); }
});

it('prepares and passes notes before the shared draft is created by the workflow', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8').replaceAll('\r\n', '\n');
  const preflight = workflow.slice(workflow.indexOf('  release-preflight:'), workflow.indexOf('\n  release:\n'));
  const notes = preflight.indexOf('run: node scripts/release-notes.mjs');
  const draft = preflight.indexOf('run: node scripts/release-ci-gate-tag.mjs --create-draft');
  expect(notes).toBeGreaterThan(-1);
  expect(draft).toBeGreaterThan(notes);
  expect(preflight).toContain('RELEASE_BODY: ${{ steps.notes.outputs.body }}');
});
