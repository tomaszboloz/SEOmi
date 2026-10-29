from pathlib import Path
import subprocess,fcntl,json,hashlib,datetime
team=Path('/tmp/seomi-gemini-20261024-1553');cwd=Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
files=list(json.loads((team/'auditor-212-selected-copy.json').read_text())['sourceHashes'])+['package.json','package-lock.json']
fingerprint=lambda:{f:hashlib.sha256((cwd/f).read_bytes()).hexdigest() for f in files}
node=['rtk','proxy','npm','exec','--yes','--package=node@22','--']
tests=['tests/renderWorkerPanel.test.tsx','tests/renderWorkerPanelBranches.test.tsx','tests/renderWorkerPanelPolling.test.tsx','tests/auditorRenderWorkerStopRaceTemporary.test.tsx']
commands=[('regressions',node+['node','node_modules/vitest/vitest.mjs','run',*tests,'--reporter=json','--outputFile='+str(team/'auditor-212-integration-tests.json')]),('typecheck',node+['node','node_modules/typescript/bin/tsc','--noEmit']),('lint',node+['npm','run','lint']),('loc',node+['npm','run','check:loc']),('version',node+['npm','run','version:check']),('diff',['rtk','proxy','git','diff','--check'])]
target=cwd/'tests/auditorRenderWorkerStopRaceTemporary.test.tsx'
print('Waiting for serialized independent #212 integration validation',flush=True)
with open('/tmp/seomi-gemini-validation.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);before=fingerprint();rows=[]
 assert not target.exists()
 target.write_bytes((team/'auditor-render-worker-stop-race.test.tsx').read_bytes())
 try:
  for stage,cmd in commands:
   log=team/('auditor-212-'+stage+'.log')
   with log.open('w')as out:r=subprocess.run(cmd,cwd=cwd,stdout=out,stderr=subprocess.STDOUT)
   row={'stage':stage,'exitCode':r.returncode,'command':cmd,'log':str(log)};rows.append(row);print(json.dumps(row),flush=True)
   if r.returncode:break
 finally:target.unlink(missing_ok=True)
 after=fingerprint();report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':len(rows)==len(commands) and all(x['exitCode']==0 for x in rows) and before==after,'sourceStable':before==after,'hashes':after,'checks':rows,'scope':'Three Gemini #212 files integrated on 5c4c02b3 plus independent original mounted/deferred same-batch reproducer; actual expiry/inactive/failed-stop controls retained'}
 (team/'auditor-212-integration-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k not in ['hashes','checks']}),flush=True)
