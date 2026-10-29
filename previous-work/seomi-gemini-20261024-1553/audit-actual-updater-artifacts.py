from pathlib import Path
import hashlib,json,subprocess,fcntl,datetime
team=Path('/tmp/seomi-gemini-20261024-1553');root=Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
author=json.loads((team/'release.actual-artifact-proof.report.json').read_text());folder=team/'actual-release-artifact-audit'
files=author['downloadedFilesManifest'];proof=[]
for name,item in files.items():
 path=folder/name
 actual={'name':name,'exists':path.exists(),'expectedSize':item['size'],'expectedSha256':item['sha256']}
 if path.exists():
  actual.update(size=path.stat().st_size,sha256=hashlib.file_digest(path.open('rb'),'sha256').hexdigest())
 actual['matches']=actual.get('size')==item['size'] and actual.get('sha256')==item['sha256'];proof.append(actual)
candidate=Path('/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi')
relative=['src-tauri/examples/verify_update_signatures.rs','src-tauri/tauri.conf.json']
equal={f:hashlib.sha256((root/f).read_bytes()).hexdigest()==hashlib.sha256((candidate/f).read_bytes()).hexdigest() for f in relative}
assert all(equal.values()),equal
with open('/tmp/seomi-gemini-validation.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 command=['rtk','proxy',str(candidate/'src-tauri/target/debug/examples/verify_update_signatures'),str(folder/'tree')]
 with (team/'auditor-actual-updater-signatures.log').open('w')as out:r=subprocess.run(command,stdout=out,stderr=subprocess.STDOUT)
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceMatchesReleaseNext':equal,'fileHashChecks':proof,'signaturesExitCode':r.returncode,'signaturesCommand':command,'matchesAllDownloadedFiles':all(x['matches']for x in proof),'scope':'Independent direct verification of existing downloaded files and canonical compiled verifier with source/key equality; no execution of installer or application payload; no CI qualification or publication'}
(team/'auditor-actual-updater-artifact-proof.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k not in ['fileHashChecks','signaturesCommand']},indent=2))
