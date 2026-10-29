import datetime, fcntl, hashlib, json, os, pathlib, subprocess, time
team=pathlib.Path('/tmp/seomi-gemini-20261024-1553')
root=pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
node='/Users/tomaszboloz/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
tests=['tests/causalImpactPanel.test.tsx','tests/causalImpactRuntime.test.tsx','tests/causalMarket.test.ts','tests/causalMarketAdapter.test.tsx','tests/causalMarketDomain.test.ts','tests/causalMarketSource.test.ts','tests/causalStorageEvents.test.ts','tests/causalLocales.test.ts','tests/experimentsEvaluate.test.ts','tests/experimentsEvaluateReasons.test.ts','tests/experimentsSignals.test.tsx','tests/experimentsPanel.test.tsx','tests/experimentsLocales.test.ts','tests/gscFiltersDatesDirect.test.ts','tests/gscPropertyMatch.test.ts','tests/gscPropertyMatchBranches.test.ts','tests/gscSlicePropertyMatch.test.ts','tests/gscDailySeries.test.ts','tests/gscDailyPersistence.test.ts']
commands=[['rtk','proxy',node,'node_modules/vitest/vitest.mjs','run',*tests],['rtk','proxy',node,'node_modules/typescript/bin/tsc','--noEmit'],['rtk','proxy',node,'node_modules/eslint/bin/eslint.js','src','tests','mcp-server/src','--max-warnings','0'],['rtk','proxy',node,'scripts/check-max-loc.mjs'],['rtk','proxy',node,'scripts/sync-app-version.mjs','--check'],['rtk','git','diff','--check']]
manifest=json.loads((team/'causal.integrated-v5.manifest.json').read_text())
fingerprint=lambda:{f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in manifest}
before=fingerprint(); results=[]
env=os.environ.copy(); env['PATH']=str(pathlib.Path(node).parent)+os.pathsep+env['PATH']
print('Root causal auditor waiting for validation lock; Node22.23.4',flush=True)
with open('/tmp/seomi-gemini-validation.lock','w') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX)
    print('Root causal auditor acquired validation lock',flush=True)
    for i,command in enumerate(commands):
        path=team/f'auditor-root-causal-v5-{i}.log'; started=time.monotonic()
        with path.open('w') as output: outcome=subprocess.run(command,cwd=root,env=env,stdout=output,stderr=subprocess.STDOUT)
        row={'command':command,'exitCode':outcome.returncode,'seconds':round(time.monotonic()-started,2),'log':str(path)}
        results.append(row); print(json.dumps(row),flush=True)
        if outcome.returncode:
            print(path.read_text(errors='replace')[-9000:],flush=True); break
after=fingerprint()
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'root integrated 30file causal package; exact local Node22.23.4 acceptance, no full application coverage or remote CI claim','results':results,'sourceStable':before==after,'manifestMatches':after==manifest,'passed':len(results)==len(commands) and all(r['exitCode']==0 for r in results) and before==after==manifest}
(team/'auditor-root-causal-v5-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
