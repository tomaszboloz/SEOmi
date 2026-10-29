from pathlib import Path
import json,hashlib,subprocess,fcntl,datetime
team=Path('/tmp/seomi-gemini-20261024-1553');cwd=Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
files=list(json.loads((team/'auditor-ci454-fixtures-selected-copy.json').read_text())['sourceHashes'])+['src/types/crawl/history.ts','src/services/contracts/crawl/crawlResult.ts','src/services/optimizationTasks/verify.ts','src/services/optimizationTasks/runVerification.ts','package.json','package-lock.json','.github/workflows/test.yml','.github/workflows/release.yml']
fingerprint=lambda:{f:hashlib.sha256((cwd/f).read_bytes()).hexdigest()for f in files}
node=['rtk','proxy','npm','exec','--yes','--package=node@22','--']
tests=['tests/coverage100PersistenceFollowupTasks.test.ts','tests/execWiringServices.test.ts','tests/modelTypeContracts.test.ts','tests/typeContracts.test.ts','tests/crawlStartedAtContracts.test.ts','tests/optimizationTasks.test.ts','tests/optimizationTaskTracker.test.tsx','tests/optimizationTasksEdgeCases.test.ts','tests/optimizationTasksCoverage.test.ts','tests/optimizationTasksEvidenceAuditor.test.ts','tests/sprsAdapterGate.test.ts','tests/crawlContractsModules.test.ts','tests/renderWorkerPanel.test.tsx','tests/renderWorkerPanelBranches.test.tsx','tests/renderWorkerPanelPolling.test.tsx','tests/desktopE2eRendererDiagnostics.test.ts','tests/desktopE2eArchitecture.test.ts','tests/desktopE2eReportValidation.test.ts']
commands=[('regressions',node+['node','node_modules/vitest/vitest.mjs','run',*tests,'--reporter=json','--outputFile='+str(team/'auditor-ci454-fixtures-integration-tests.json')]),('typecheck',node+['node','node_modules/typescript/bin/tsc','--noEmit']),('lint',node+['npm','run','lint']),('loc',node+['npm','run','check:loc']),('version',node+['npm','run','version:check']),('diff',['rtk','proxy','git','diff','--check'])]
print('Waiting for independent current-SHA CI fixture integration validation',flush=True)
with open('/tmp/seomi-gemini-validation.lock','a')as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);before=fingerprint();rows=[]
 for stage,cmd in commands:
  log=team/('auditor-ci454-fixtures-'+stage+'.log')
  with log.open('w')as out:r=subprocess.run(cmd,cwd=cwd,stdout=out,stderr=subprocess.STDOUT)
  rows.append({'stage':stage,'exitCode':r.returncode,'command':cmd,'log':str(log)});print(json.dumps(rows[-1]),flush=True)
  if r.returncode:break
 after=fingerprint();report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':len(rows)==len(commands)and all(r['exitCode']==0 for r in rows)and before==after,'sourceStable':before==after,'hashes':after,'checks':rows,'scope':'Five Gemini CI fixture/additive-contract tests on integrated root source; all four observed red failures included; production freshness and numeric/workflow gates unchanged'}
 (team/'auditor-ci454-fixtures-integration-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k not in ['hashes','checks']}),flush=True)
