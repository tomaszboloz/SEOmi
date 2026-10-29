import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const root = '/Users/tomaszboloz/.codex/worktrees/github-next/seomi';
const src = resolve(root, 'src');
const tsPath = '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/node_modules/typescript/lib/typescript.js';
const ts = (await import(tsPath)).default;
const require = createRequire('/Users/tomaszboloz/.codex/worktrees/release-next/seomi/package.json');

console.log('TypeScript loaded successfully');
