import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const compile = spawnSync('cargo', ['build', '--manifest-path', 'src-tauri/Cargo.toml', '--example', 'desktop_e2e', '--features', 'custom-protocol'], { stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const directory = mkdtempSync(join(tmpdir(), 'seomi-desktop-e2e-'));
const report = join(directory, 'result.json');
const executable = resolve('src-tauri/target/debug/examples', process.platform === 'win32' ? 'desktop_e2e.exe' : 'desktop_e2e');
const child = spawn(executable, [report], { stdio: 'inherit' });
let timedOut = false;
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 100000);
child.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timer);
  try {
    const result = JSON.parse(readFileSync(report, 'utf8'));
    mkdirSync('test-results', { recursive: true });
    copyFileSync(report, 'test-results/desktop-e2e.json');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = code === 0 && result.passed === true && !timedOut ? 0 : 1;
  } catch {
    console.error(timedOut ? 'Desktop E2E runtime timed out.' : `Desktop E2E exited ${code} without a report.`);
    process.exitCode = 1;
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
