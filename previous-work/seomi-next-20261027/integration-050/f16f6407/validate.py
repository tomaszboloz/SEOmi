import json, os, pathlib, subprocess, time

ws = '/Users/tomaszboloz/.codex/worktrees/ai-trust-integration-050/seomi'
out = pathlib.Path(__file__).parent
env = os.environ.copy()
env['PATH'] = '/Users/tomaszboloz/.nvm/versions/node/v24.19.0/bin:' + env['PATH']
env['CARGO_TARGET_DIR'] = '/Volumes/Kingston/www/seomi-target-trust050'
head = subprocess.check_output(['rtk', 'proxy', 'git', 'rev-parse', 'HEAD'], cwd=ws, text=True).strip()
commands = [
    ('frontend-coverage', ['rtk', 'npm', 'run', 'test:coverage:target']),
    ('mcp-coverage', ['rtk', 'npm', 'run', 'test:coverage:mcp']),
    ('rust-unit', ['rtk', 'cargo', 'test', '--manifest-path', 'src-tauri/Cargo.toml', '--lib']),
    ('rust-clippy', ['rtk', 'cargo', 'clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--lib', '--tests', '--', '-D', 'warnings']),
    ('frontend-build', ['rtk', 'npm', 'run', 'build']),
    ('lint', ['rtk', 'npm', 'run', 'lint']),
    ('loc', ['rtk', 'npm', 'run', 'check:loc']),
    ('version', ['rtk', 'npm', 'run', 'version:check']),
    ('diff', ['rtk', 'git', 'diff', '--check']),
]
rows = []
for name, cmd in commands:
    print(name + ' running', flush=True)
    start = time.time()
    with (out / (name + '.log')).open('w') as log:
        result = subprocess.run(cmd, cwd=ws, env=env, stdout=log, stderr=subprocess.STDOUT)
    rows.append({'name': name, 'exitCode': result.returncode, 'seconds': round(time.time() - start, 2)})
    print(rows[-1], flush=True)
    if result.returncode:
        print((out / (name + '.log')).read_text()[-7000:], flush=True)
    (out / 'validation.json').write_text(json.dumps({'head': head, 'complete': False, 'results': rows}, indent=2) + '\n')
status = subprocess.check_output(['rtk', 'proxy', 'git', 'status', '--porcelain'], cwd=ws, text=True)
final_head = subprocess.check_output(['rtk', 'proxy', 'git', 'rev-parse', 'HEAD'], cwd=ws, text=True).strip()
clean = not status.strip() and final_head == head
(out / 'validation.json').write_text(json.dumps({'head': head, 'sourceFrozen': clean, 'complete': True, 'results': rows}, indent=2) + '\n')
raise SystemExit(0 if clean and all(row['exitCode'] == 0 for row in rows) else 1)
