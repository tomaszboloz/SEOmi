import fcntl, hashlib, json, pathlib, subprocess, time
root = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
team = pathlib.Path('/tmp/seomi-gemini-20261024-1553')
tests = ['tests/causalImpactPanel.test.tsx', 'tests/causalImpactRuntime.test.tsx', 'tests/causalMarket.test.ts', 'tests/causalMarketAdapter.test.tsx', 'tests/causalMarketDomain.test.ts', 'tests/causalMarketSource.test.ts', 'tests/causalStorageEvents.test.ts', 'tests/experimentsEvaluate.test.ts', 'tests/experimentsEvaluateReasons.test.ts', 'tests/experimentsSignals.test.tsx', 'tests/experimentsPanel.test.tsx', 'tests/experimentsLocales.test.ts', 'tests/gscFiltersDatesDirect.test.ts', 'tests/gscPropertyMatch.test.ts', 'tests/gscPropertyMatchBranches.test.ts', 'tests/gscSlicePropertyMatch.test.ts', 'tests/gscDailySeries.test.ts', 'tests/gscDailyPersistence.test.ts']
commands = [['rtk', 'proxy', './node_modules/.bin/vitest', 'run', *tests], ['rtk', 'proxy', './node_modules/.bin/tsc', '--noEmit'], ['rtk', 'npm', 'run', 'lint'], ['rtk', 'npm', 'run', 'check:loc'], ['rtk', 'npm', 'run', 'version:check'], ['rtk', 'git', 'diff', '--check']]
manifest = json.loads((team / 'causal.manifest.json').read_text())
fingerprint = lambda: {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in manifest}
before = fingerprint()
results = []
print('Waiting for serialized validation lock', flush=True)
with open('/tmp/seomi-gemini-validation.lock', 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    print('Auditor acquired validation lock', flush=True)
    for i, command in enumerate(commands):
        started = time.time()
        path = team / f'auditor-causal-v2-{i}.log'
        with path.open('w') as output:
            result = subprocess.run(command, cwd=root, stdout=output, stderr=subprocess.STDOUT)
        row = dict(command=command, exitCode=result.returncode, seconds=round(time.time()-started, 2), log=str(path))
        results.append(row)
        print(json.dumps(row), flush=True)
        if result.returncode:
            print(path.read_text(errors='replace')[-12000:], flush=True)
            break
after = fingerprint()
report = dict(results=results, filesStable=before==after, manifestMatches=after==manifest)
(team / 'auditor-causal-v2-result.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report), flush=True)
