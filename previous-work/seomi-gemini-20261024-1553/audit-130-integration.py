from pathlib import Path
import json,hashlib,subprocess,fcntl,datetime
team=Path('/tmp/seomi-gemini-20261024-1553');cwd=Path('/Users/tomaszboloz/.codex/worktrees/task-verification/seomi')
files=['src/types/crawl/history.ts','src/services/contracts/crawl/crawlResult.ts','src/components/Charts/semanticTopical/signals/sprsAdapter.ts','src/services/optimizationTasks/verify.ts','src/services/optimizationTasks/runVerification.ts','src/stores/tools/crawl/execution.ts','src/services/sprs/report.ts','tests/optimizationTasksEdgeCases.test.ts','tests/optimizationTasksCoverage.test.ts','tests/optimizationTasksEvidenceAuditor.test.ts','package.json','package-lock.json']
node=['rtk','proxy','npm','exec','--yes','--package=node@22','--']
tests=['tests/optimizationTasks.test.ts','tests/optimizationTaskTracker.test.tsx','tests/optimizationTasksEdgeCases.test.ts','tests/optimizationTasksCoverage.test.ts','tests/optimizationTasksEvidenceAuditor.test.ts','tests/sprsAdapterGate.test.ts','tests/sprs.test.ts','tests/sprsPanel.test.tsx','tests/sprsWhatIfSnapshot.test.tsx','tests/sprsZoneWeights.test.ts','tests/crawlExecutionActionsDirect.test.ts','tests/crawlExecutionEventsDirect.test.ts','tests/crawlExecutionEdgesDirect.test.ts','tests/crawlExecutionDeepBranches.test.ts','tests/crawlExecutionHookActions.test.ts','tests/crawlExecutionHookComparison.test.ts','tests/crawlExecutionHookEvents.test.ts','tests/crawlExecutionHookOwnership.test.ts','tests/crawlContractsModules.test.ts']
commands=[('typecheck',node+['node','node_modules/typescript/bin/tsc','--noEmit']),('regressions',node+['node','node_modules/vitest/vitest.mjs','run',*tests,'--reporter=json','--outputFile='+str(team/'auditor-130-integration-tests.json')]),('lint',node+['npm','run','lint']),('loc',node+['npm','run','check:loc']),('version',node+['npm','run','version:check']),('diff',['rtk','proxy','git','diff','--check'])]
fingerprint=lambda:{f:hashlib.sha256((cwd/f).read_bytes()).hexdigest() for f in files}
print('Waiting for serialized independent #130 validation',flush=True)
with open('/tmp/seomi-gemini-validation.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);before=fingerprint();rows=[]
 for stage,cmd in commands:
  log=team/('auditor-130-'+stage+'.log')
  with log.open('w')as out:r=subprocess.run(cmd,cwd=cwd,stdout=out,stderr=subprocess.STDOUT)
  rows.append({'stage':stage,'exitCode':r.returncode,'command':cmd,'log':str(log)});print(json.dumps(rows[-1]),flush=True)
  if r.returncode:break
 after=fingerprint();report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':len(rows)==len(commands) and all(x['exitCode']==0 for x in rows) and before==after,'sourceStable':before==after,'hashes':after,'checks':rows,'scope':'Isolated Gemini #130 patch applied to b13192f2, compatible latest frontend/MCP; excludes unqualified #138 event hook. Local integration proof only.'}
 (team/'auditor-130-integration-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k not in ['hashes','checks']}),flush=True)
