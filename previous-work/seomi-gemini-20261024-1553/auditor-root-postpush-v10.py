import datetime, fcntl, hashlib, json, os, pathlib, subprocess, time

team = pathlib.Path('/tmp/seomi-gemini-20261024-1553')
root = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
node = '/Users/tomaszboloz/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'

def git(*args):
    return subprocess.check_output(['rtk', 'proxy', 'git', *args], cwd=root)

def fingerprint():
    paths = set(git('ls-files', '-z').decode().split('\0'))
    paths.update(git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'))
    return {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in sorted(paths) if p and (root / p).is_file()}

head_before = git('rev-parse', 'HEAD').decode().strip()
before = fingerprint()
commands = [
    ['rtk', 'proxy', node, 'node_modules/vitest/vitest.mjs', 'run', '--reporter=json', '--outputFile=' + str(team / 'auditor-root-postpush-v10-vitest.json')],
    ['rtk', 'proxy', 'cargo', 'test', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--features', 'custom-protocol,test-fixture'],
]
env = os.environ.copy()
env['PATH'] = str(pathlib.Path(node).parent) + ':' + env['PATH']
env['CARGO_TARGET_DIR'] = '/Volumes/Kingston/seomi-build/rust-latest-review'
results = []
print(json.dumps({'head': head_before, 'files': len(before), 'status': 'waiting for serialized validation lock'}), flush=True)
with open('/tmp/seomi-gemini-validation.lock', 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    for i, command in enumerate(commands):
        log = team / f'auditor-root-postpush-v10-{i}.log'
        print(json.dumps({'step': i, 'status': 'STARTED', 'command': command}), flush=True)
        started = time.monotonic()
        with log.open('w') as output:
            outcome = subprocess.run(command, cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
        result = {'step': i, 'command': command, 'exitCode': outcome.returncode, 'seconds': round(time.monotonic() - started, 2), 'log': str(log)}
        results.append(result)
        print(json.dumps(result), flush=True)
        if outcome.returncode:
            print(log.read_text(errors='replace')[-5000:], flush=True)
            break
after = fingerprint()
head_after = git('rev-parse', 'HEAD').decode().strip()
report = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'complete local frontend and native suites on final0.4.41 source; not 95/98 coverage, remote Intel/Windows, main merge or published release proof', 'headBefore': head_before, 'headAfter': head_after, 'before': before, 'after': after, 'sourceStable': before == after, 'headStable': head_before == head_after, 'results': results, 'passed': len(results) == len(commands) and all(r['exitCode'] == 0 for r in results) and before == after and head_before == head_after}
(team / 'auditor-root-postpush-v10-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['before', 'after']}), flush=True)
