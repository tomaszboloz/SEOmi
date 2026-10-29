import datetime, fcntl, hashlib, json, os, pathlib, subprocess, sys, time

team = pathlib.Path('/tmp/seomi-gemini-20261024-1553')
root = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
node = '/Users/tomaszboloz/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
paths = set(subprocess.check_output(['rtk', 'proxy', 'git', 'diff', '--name-only'], cwd=root, text=True).splitlines())
paths.update(subprocess.check_output(['rtk', 'proxy', 'git', 'ls-files', '--others', '--exclude-standard'], cwd=root, text=True).splitlines())
paths = {p for p in paths if (root / p).is_file()}
fingerprint = lambda: {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in sorted(paths)}
before = fingerprint()
tests = ['tests/desktopE2eArchitecture.test.ts', 'tests/desktopE2eRendererDiagnostics.test.ts', 'tests/desktopE2eReportValidation.test.ts', 'tests/desktopE2eFixtureUrl.test.ts', 'tests/releaseCiGate.test.ts', 'tests/releaseCiGateTag.test.ts', 'tests/releaseCiGateEdge.test.ts', 'tests/releaseCiGateCli.test.ts', 'tests/releaseCiGateAssets.test.ts', 'tests/releaseCiGateManifest.test.ts', 'tests/releaseCiGateLifecycle.test.ts', 'tests/releaseCiGateInventory.test.ts', 'tests/releaseCiGateProvenance.test.ts', 'tests/ciActionPins.test.ts', 'tests/ciQualityGates.test.ts']
commands = [
    ['rtk', 'proxy', 'cargo', 'fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--check'],
    ['rtk', 'proxy', node, 'node_modules/vitest/vitest.mjs', 'run', *tests, '--reporter=json', '--outputFile=' + str(team / 'auditor-root-combined-v6-vitest.json')],
    ['rtk', 'npm', 'run', 'lint'],
    ['rtk', 'npm', 'run', 'check:loc'],
    ['rtk', 'npm', 'run', 'version:check'],
    ['rtk', 'npm', 'run', 'build'],
    ['rtk', 'proxy', 'cargo', 'clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--features', 'custom-protocol,test-fixture', '--', '-D', 'warnings'],
    ['rtk', 'proxy', 'cargo', 'test', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--features', 'custom-protocol,test-fixture'],
    ['rtk', 'proxy', 'python3', str(team / 'auditor-root-desktop-canonical-v6.py')],
    ['rtk', 'proxy', node, 'scripts/validate-desktop-e2e-report.mjs', 'test-results/desktop-e2e.json'],
    ['rtk', 'proxy', 'cargo', 'check', '--manifest-path', 'src-tauri/Cargo.toml', '--release', '--lib'],
    ['rtk', 'git', 'diff', '--check'],
]
env = os.environ.copy()
env['PATH'] = str(pathlib.Path(node).parent) + ':' + env['PATH']
env['SEOMI_E2E_RENDERER'] = '1'
env['CARGO_TARGET_DIR'] = '/Volumes/Kingston/seomi-build/rust-latest-review'
results = []
start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
print('Combined root validation waiting for flock', flush=True)
with open('/tmp/seomi-gemini-validation.lock', 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    print('Combined root validation acquired flock', flush=True)
    for i, command in enumerate(commands):
        if i < start:
            continue
        log = team / f'auditor-root-combined-v6-from-{start}-step-{i}.log'
        started = time.monotonic()
        print(json.dumps({'step': i, 'command': command, 'status': 'STARTED'}), flush=True)
        with log.open('w') as output:
            result = subprocess.run(command, cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
        row = {'step': i, 'command': command, 'exitCode': result.returncode, 'seconds': round(time.monotonic() - started, 2), 'log': str(log)}
        results.append(row)
        print(json.dumps(row), flush=True)
        if result.returncode:
            print(log.read_text(errors='replace')[-6000:], flush=True)
            break
after = fingerprint()
report = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'combined root ARM64 native latest, fixture and release provenance acceptance; no remote CI, OIDC, coverage or release claim', 'startStep': start, 'before': before, 'after': after, 'sourceStable': before == after, 'results': results, 'passed': len(results) == len(commands) - start and all(r['exitCode'] == 0 for r in results) and before == after}
(team / f'auditor-root-combined-v6-validation-from-{start}.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['before', 'after']}), flush=True)
