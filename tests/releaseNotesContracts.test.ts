import { describe, expect, it } from 'vitest';
import { releaseBody } from '../scripts/release-notes.mjs';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const notes = '# SEOmi 0.0.4 — release notes\n\n## Fixed\n\n- GA4 property matching.\n\n## Thanks\n\nThank you @RafalSzy.';

describe('release notes publication contract', () => {
  it('uses the concrete changes and contributor credit as the release body', () => {
    expect(releaseBody('0.0.4', notes, 'v0.0.4')).toBe('## Fixed\n\n- GA4 property matching.\n\n## Thanks\n\nThank you @RafalSzy.');
    expect(releaseBody('0.0.4', notes.replaceAll('\n', '\r\n'))).toBe(releaseBody('0.0.4', notes));
  });
  it('rejects a tag or notes belonging to another version', () => {
    expect(() => releaseBody('0.0.4', notes, 'v0.0.3')).toThrow('tag differs');
    expect(() => releaseBody('0.0.5', notes)).toThrow('current version');
  });
  it('rejects draft and unfinished notes before publishing', () => {
    expect(() => releaseBody('0.0.4', notes.replace('release notes', 'release notes draft'))).toThrow('final title');
    for (const status of ['This release has not been published.', 'Platform checks remain in progress.', 'Font support remains open.', 'Links will be added after verification.']) {
      expect(() => releaseBody('0.0.4', `${notes}\n${status}`)).toThrow('unfinished release');
    }
  });
  it('requires a dedicated thanks section and contributor identity', () => {
    expect(() => releaseBody('0.0.4', notes.replace('## Thanks', '## Quality'))).toThrow('thank the contributors');
    expect(() => releaseBody('0.0.4', notes.replace('@RafalSzy', 'everyone'))).toThrow('thank the contributors');
  });
  it.each([false, true])('writes the CI body only when the notes are final (draft: %s)', draft => {
    const directory = mkdtempSync(join(tmpdir(), 'seomi-release-notes-'));
    const output = join(directory, 'github-output');
    try {
      writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '0.0.4' }));
      writeFileSync(join(directory, 'RELEASE_NOTES.md'), draft ? notes.replace('release notes', 'release notes draft') : notes);
      const result = spawnSync(process.execPath, [resolve('scripts/release-notes.mjs')], {
        cwd: directory,
        env: { ...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'v0.0.4', GITHUB_OUTPUT: output },
        encoding: 'utf8',
      });
      if (draft) {
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('final title');
        expect(existsSync(output)).toBe(false);
      } else {
        expect(result.status).toBe(0);
        const lines = readFileSync(output, 'utf8').trimEnd().split('\n');
        const delimiter = lines[0].replace('body<<', '');
        expect(delimiter).toMatch(/^release_[\da-f-]+$/);
        expect(lines.at(-1)).toBe(delimiter);
        expect(lines.slice(1, -1).join('\n')).toBe('## Fixed\n\n- GA4 property matching.\n\n## Thanks\n\nThank you @RafalSzy.');
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
