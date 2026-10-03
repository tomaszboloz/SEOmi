import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { sourceFiles, sourceHashes } from './public-function-inventory.mjs';

const files = [...sourceFiles('src'), ...sourceFiles('mcp-server/src/contracts')];
const before = sourceHashes(files);
mkdirSync('test-results', { recursive: true });
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--coverage', ...process.argv.slice(2)], { stdio: 'inherit' });
const after = sourceHashes(files);
if (JSON.stringify(before) !== JSON.stringify(after)) {
  console.error('Source changed during coverage measurement; execution evidence rejected.');
  writeFileSync('test-results/frontend-coverage-sources.json', '{}');
  process.exitCode = 1;
} else {
  writeFileSync('test-results/frontend-coverage-sources.json', JSON.stringify(result.status === 0 ? before : {}, null, 2));
  process.exitCode = result.status ?? 1;
}
