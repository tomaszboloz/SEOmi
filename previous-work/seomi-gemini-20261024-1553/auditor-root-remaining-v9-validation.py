import datetime, fcntl, hashlib, json, os, pathlib, subprocess, time

team = pathlib.Path('/tmp/seomi-gemini-20261024-1553')
root = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
node = '/Users/tomaszboloz/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
paths = set(subprocess.check_output(['rtk', 'proxy', 'git', 'diff', '--name-only'], cwd=root, text=True).splitlines())
paths.update(subprocess.check_output(['rtk', 'proxy', 'git', 'ls-files', '--others', '--exclude-standard'], cwd=root, text=True).splitlines())
paths = {p for p in paths if (root / p).is_file()}
fingerprint = lambda: {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in sorted(paths)}
before = fingerprint()
commands = [
    ['rtk', 'proxy', node, 'node_modules/typescript/bin/tsc', '--noEmit'],
    ['rtk', 'npm', 'run', 'lint'],
    ['rtk', 'npm', 'run', 'check:loc'],
    ['rtk', 'npm', 'run', 'version:check'],
    ['rtk', 'npm', 'run', 'build'],
    ['rtk', 'proxy', 'cargo', 'test', '--manifest-path', 'src-tauri/Cargo.toml', '--example', 'desktop_e2e', '--features', 'custom-protocol,test-fixture'],
    ['rtk', 'proxy', 'python3', str(team / 'auditor-root-desktop-canonical-v6.py')],
    ['rtk', 'proxy', node, 'scripts/validate-desktop-e2e-report.mjs', 'test-results/desktop-e2e.json'],
    ['rtk', 'git', 'diff', '--check'],
]
env = os.environ.copy()
env['PATH'] = str(pathlib.Path(node).parent) + ':' + env['PATH']
env['CARGO_TARGET_DIR'] = '/Volumes/Kingston/seomi-build/rust-latest-review'
env['SEOMI_E2E_RENDERER'] = '1'
results = []
print('Final root validation waiting for flock', flush=True)
with open('/tmp/seomi-gemini-validation.lock', 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    print('Final root validation acquired flock', flush=True)
    for i, command in enumerate(commands):
        log = team / f'auditor-root-remaining-v9-step-{i}.log'
        print(json.dumps({'step': i, 'status': 'STARTED', 'command': command}), flush=True)
        started = time.monotonic()
        with log.open('w') as output:
            result = subprocess.run(command, cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
        row = {'step': i, 'command': command, 'exitCode': result.returncode, 'seconds': round(time.monotonic() - started, 2), 'log': str(log)}
        results.append(row)
        print(json.dumps(row), flush=True)
        if result.returncode:
            print(log.read_text(errors='replace')[-4000:], flush=True)
            break
after = fingerprint()
report = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'remaining root0.4.41 checks after full frontend identified4fixture/contracts failures; not a full frontend PASS claim, coverage or remote CI claim', 'before': before, 'after': after, 'sourceStable': before == after, 'results': results, 'passed': len(results) == len(commands) and all(r['exitCode'] == 0 for r in results) and before == after}
(team / 'auditor-root-remaining-v9-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['before', 'after']}), flush=True)
