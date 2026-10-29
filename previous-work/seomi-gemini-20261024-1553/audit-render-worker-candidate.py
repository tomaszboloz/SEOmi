from pathlib import Path
import subprocess,fcntl,json,hashlib,datetime
team=Path('/tmp/seomi-gemini-20261024-1553')
cwd=Path('/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi')
source=cwd/'src/components/Settings/RenderWorkerPanel.tsx'
target=cwd/'tests/auditorRenderWorkerStopRaceTemporary.test.tsx'
with open('/tmp/seomi-gemini-validation.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 assert not target.exists()
 before=hashlib.sha256(source.read_bytes()).hexdigest()
 try:
  target.write_bytes((team/'auditor-render-worker-stop-race.test.tsx').read_bytes())
  cmd=['rtk','proxy','npm','exec','--yes','--package=node@22','--','node','node_modules/vitest/vitest.mjs','run','tests/auditorRenderWorkerStopRaceTemporary.test.tsx','--reporter=json','--outputFile='+str(team/'auditor-render-worker-candidate-tests.json')]
  with (team/'auditor-render-worker-candidate.log').open('w') as output:
   result=subprocess.run(cmd,cwd=cwd,stdout=output,stderr=subprocess.STDOUT)
 finally:
  target.unlink(missing_ok=True)
 after=hashlib.sha256(source.read_bytes()).hexdigest()
 report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'sourceStable':before==after,'sourceSHA256':after,'physicalLines':len(source.read_bytes().splitlines()),'scope':'Independent deterministic production candidate same-batch stop/poll regression; no author tests or final LOC qualification implied'}
 (team/'auditor-render-worker-candidate-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report),flush=True)
