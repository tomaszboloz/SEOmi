import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertIndependentProductSources } from './release-product-branding.mjs';

const TOKENS = 'PRD|GAP|PARITY_MATRIX|MATRIX|AGENTS|CLAUDE|GEMINI|COPILOT|AI_NOTES|AI_CONTEXT|AI_PLAN';
const DOCUMENT = new RegExp(`^(?:${TOKENS})(?:[_.-][^/]*)?\\.(?:md|markdown|mdx|txt|rst|adoc|json|ya?ml)$`, 'i');
const BARE_NAME = new RegExp(`^(?:${TOKENS})$`, 'i');
const AGENT_DIRECTORY = /^\.(?:agents?|claude|gemini|codex)$/i;

export const isForbiddenReleasePath = (file) => {
  const parts = file.replace(/\\/g, '/').split('/');
  return parts.some((part) => BARE_NAME.test(part) || AGENT_DIRECTORY.test(part)) || DOCUMENT.test(parts.at(-1));
};

export const assertIndependentReleaseFiles = (files) => {
  const forbidden = files.filter(isForbiddenReleasePath);
  if (forbidden.length) throw new Error(`Planning or AI instruction files must not be tracked:\n${forbidden.join('\n')}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  assertIndependentReleaseFiles(files);
  assertIndependentProductSources(files);
  console.log(`Verified ${files.length} tracked release input paths.`);
}
