import { describe, expect, it } from 'vitest';
import { releaseBody } from '../scripts/release-notes.mjs';

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
});
