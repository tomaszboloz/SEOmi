import { appendFileSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

export function releaseBody(version, notes, tag = null) {
  if (tag !== null && tag !== `v${version}`) throw new Error('Release tag differs from the application version.');
  const text = notes.replaceAll('\r\n', '\n').trim();
  const [title, ...body] = text.split('\n');
  if (title !== `# SEOmi ${version} — release notes`) throw new Error('Release notes need the current version and a final title.');
  if (/has not been published|remain(?:s)? in progress|remains open|will be added after/i.test(text)) {
    throw new Error('Release notes still contain unfinished release work.');
  }
  const content = body.join('\n').trim();
  if (!/^## Thanks\s*$/m.test(content) || !/@[a-z\d][a-z\d-]*/i.test(content)) {
    throw new Error('Release notes must thank the contributors by name.');
  }
  return content;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const tag = process.env.GITHUB_EVENT_NAME === 'push' ? process.env.GITHUB_REF_NAME : null;
  const body = releaseBody(version, readFileSync('RELEASE_NOTES.md', 'utf8'), tag);
  const delimiter = `release_${randomUUID()}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `body<<${delimiter}\n${body}\n${delimiter}\n`);
}
