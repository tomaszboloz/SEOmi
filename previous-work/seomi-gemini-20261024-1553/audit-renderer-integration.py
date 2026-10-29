from pathlib import Path
import json,hashlib,subprocess,fcntl,datetime,os
team=Path('/tmp/seomi-gemini-20261024-1553');cwd=Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
files=list(json.loads((team/'auditor-renderer-selected-copy.json').read_text())['sourceHashes'])+['src-tauri/Cargo.toml','src-tauri/Cargo.lock','package.json','package-lock.json']
fingerprint=lambda:{f:hashlib.sha256((cwd/f).read_bytes()).hexdigest()for f in files}
node=['rtk','proxy','npm','exec','--yes','--package=node@22','--']
commands=[('regressions',node+['node','node_modules/vitest/vitest.mjs','run','tests/desktopE2eRendererDiagnostics.test.ts','tests/desktopE2eArchitecture.test.ts','tests/desktopE2eReportValidation.test.ts','--reporter=json','--outputFile='+str(team/'auditor-renderer-integration-tests.json')]),('typecheck',node+['node','node_modules/typescript/bin/tsc','--noEmit']),('lint',node+['npm','run','lint']),('fmt',['rtk','proxy','cargo','fmt','--manifest-path','src-tauri/Cargo.toml','--all','--check']),('rust-contracts',['rtk','proxy','cargo','test','--manifest-path','src-tauri/Cargo.toml','--locked','--example','desktop_e2e','--features','custom-protocol']),('loc',node+['npm','run','check:loc']),('version',node+['npm','run','version:check']),('diff',['rtk','proxy','git','diff','--check'])]
env=dict(os.environ,CARGO_TARGET_DIR='/Volumes/Kingston/seomi-build/moved-targets-20261024/github-next')
print('Waiting for serialized independent renderer diagnostics validation',flush=True)
with open('/tmp/seomi-gemini-validation.lock','a')as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);before=fingerprint();rows=[]
 for stage,cmd in commands:
  log=team/('auditor-renderer-'+stage+'.log')
  with log.open('w')as out:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT)
  rows.append({'stage':stage,'exitCode':r.returncode,'command':cmd,'log':str(log)});print(json.dumps(rows[-1]),flush=True)
  if r.returncode:break
 after=fingerprint();report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':len(rows)==len(commands)and all(r['exitCode']==0 for r in rows)and before==after,'sourceStable':before==after,'hashes':after,'checks':rows,'scope':'Isolated three-file bounded diagnostics patch; actual renderer JS behavior exercised, strict HTML assertion retained; native Intel failure cause not proven fixed'}
 (team/'auditor-renderer-integration-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k not in ['hashes','checks']}),flush=True)
