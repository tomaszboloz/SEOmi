import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = mkdtempSync(join(tmpdir(), 'seomi-strix-'));
const source = join(snapshot, 'source');
const output = join(root, 'reports', 'strix');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' }).split('\0').filter(file =>
    /^(src|src-tauri\/src|tests|scripts|mcp-server\/src)\//.test(file)
    && /\.(rs|tsx?|mjs|json)$/.test(file));
const candidates = [...tracked.split('\0').filter(Boolean), ...untracked];
let copied = 0;
for (const relative of new Set(candidates)) {
  if (/(^|\/)(\.env[^/]*|secrets\.json|config\.local\.json)$|\.(key|pem|p12|pfx)$/.test(relative)) continue;
  const original = join(root, relative);
  try {
    if (!lstatSync(original).isFile()) continue;
  } catch { continue; }
  const target = join(source, relative);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(original, target);
  copied++;
}
mkdirSync(output, { recursive: true });
const instruction = join(snapshot, 'scope.md');
writeFileSync(instruction, `Assess only the supplied disposable SEOmi source directory.
This is an authorized security assessment of the owner's Tauri/Rust/React desktop app.
Inspect native IPC, URL/redirect validation and SSRF, OAuth callback/state and token
handling, secret storage, filesystem traversal, command injection/local CLI, HTML
rendering/XSS, MCP isolation, updater signature verification and trust boundaries.
Reproduce findings with isolated tests and synthetic credentials in the copy only.
Do not attack Google, GitHub, model providers or other third-party services.
Do not read host credentials, scan the LAN, or access production projects.
Do not alter the original checkout. Do not weaken tests, limits, CSP or permissions.
Separate confirmed PoCs from suspicions and untested platform-specific behavior.
Include affected files, reproduction steps and recommended fixes in the report.
`);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const metadata = { source, copied, commit, original: root, startedAt: new Date().toISOString() };
writeFileSync(join(output, 'latest-preparation.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
if (!process.argv.includes('--prepare')) {
  const config = join(homedir(), '.strix', 'seomi-config.json');
  const settings = JSON.parse(readFileSync(config, 'utf8')).env;
  if (!settings?.STRIX_LLM) throw new Error('Configure STRIX_LLM in ~/.strix/seomi-config.json');
  const result = spawnSync('strix', [
    '-n', '-t', source, '--scope-mode', 'full', '--scan-mode', 'quick',
    '--max-turns', '40', '--instruction-file', instruction,
    '--config', config,
  ], { cwd: output, stdio: 'inherit', env: {
    ...process.env, ...settings, STRIX_TELEMETRY: '0',
  } });
  if (result.error) console.error(result.error.message);
  writeFileSync(join(output, 'latest-completion.json'), JSON.stringify({
    ...metadata, finishedAt: new Date().toISOString(), exitCode: result.status,
    error: result.error?.message,
  }, null, 2) + '\n');
  process.exitCode = result.status ?? 1;
}
