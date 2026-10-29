from pathlib import Path
import subprocess,fcntl,json,hashlib,datetime,os
team=Path(__file__).parent;cwd=Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
files=list(json.loads((team/'auditor-release-guard-selected-copy.json').read_text())['sourceHashes'])+['package.json','package-lock.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock']
fingerprint=lambda:{x:hashlib.sha256((cwd/x).read_bytes()).hexdigest() for x in files}
node=['rtk','proxy','npm','exec','--yes','--package=node@22','--']
tests=['tests/releaseCiGate.test.ts','tests/releaseCiGateTag.test.ts','tests/releaseCiGateEdge.test.ts','tests/releaseCiGateCli.test.ts','tests/releaseCiGateAssets.test.ts','tests/releaseCiGateManifest.test.ts','tests/releaseCiGateLifecycle.test.ts','tests/releaseCiGateInventory.test.ts','tests/ciActionPins.test.ts','tests/ciQualityGates.test.ts']
commands=[('typecheck',node+['node','node_modules/typescript/bin/tsc','--noEmit']),('regressions',node+['node','node_modules/vitest/vitest.mjs','run',*tests,'--reporter=json','--outputFile='+str(team/'auditor-release-guard-integration-tests.json')]),('lint',node+['npm','run','lint']),('loc',node+['npm','run','check:loc']),('version',node+['npm','run','version:check']),('diff',['rtk','proxy','git','diff','--check'])]
print('Waiting for serialized frozen release guard validation',flush=True)
with open('/tmp/seomi-gemini-validation.lock','a')as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);before=fingerprint();rows=[]
 for stage,cmd in commands:
  log=team/('auditor-release-guard-integration-'+stage+'.log')
  with log.open('w')as out:r=subprocess.run(cmd,cwd=cwd,stdout=out,stderr=subprocess.STDOUT)
  row={'stage':stage,'exitCode':r.returncode,'command':cmd,'log':str(log)};rows.append(row);print(json.dumps(row),flush=True)
  if r.returncode:break
 after=fingerprint();report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':len(rows)==len(commands)and all(x['exitCode']==0 for x in rows)and before==after,'sourceStable':before==after,'hashes':after,'checks':rows,'scope':'Exact isolated release-next authored guards/workflows/test source; local regressions and quality checks, not real installer/remote CI/publication proof'}
 (team/'auditor-release-guard-integration-result.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k not in ['hashes','checks']}),flush=True)
