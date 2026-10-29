import datetime, fcntl, hashlib, json, os, pathlib, subprocess, time
team = pathlib.Path('/tmp/seomi-gemini-20261024-1553')
root = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
manifest = json.loads((team/'native.rust-latest-v3.report.json').read_text())['hashManifest']
fingerprint = lambda: {f: hashlib.sha256((root/f).read_bytes()).hexdigest() for f in manifest}
commands = [
    ['rtk','proxy','cargo','fmt','--manifest-path','src-tauri/Cargo.toml','--check'],
    ['rtk','proxy','cargo','clippy','--manifest-path','src-tauri/Cargo.toml','--all-targets','--','-D','warnings'],
    ['rtk','proxy','cargo','test','--manifest-path','src-tauri/Cargo.toml','--all-targets'],
    ['rtk','proxy','cargo','test','--manifest-path','src-tauri/Cargo.toml','--example','desktop_e2e','--features','custom-protocol'],
    ['rtk','proxy','cargo','run','--quiet','--manifest-path','src-tauri/Cargo.toml','--example','coverage_sources'],
    ['rtk','proxy','cargo','run','--quiet','--manifest-path','src-tauri/Cargo.toml','--example','function_inventory'],
    ['rtk','npm','run','check:loc'],
    ['rtk','npm','run','version:check'],
    ['rtk','git','diff','--check'],
]
before = fingerprint()
results = []
env = os.environ.copy()
env['CARGO_TARGET_DIR']='/Volumes/Kingston/seomi-build/rust-latest-review'
print('Root auditor waiting for serialized validation lock',flush=True)
with open('/tmp/seomi-gemini-validation.lock','w') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX)
    print('Root auditor acquired validation lock',flush=True)
    for index, command in enumerate(commands):
        path=team/f'auditor-root-rust-latest-{index}.log'
        started=time.monotonic()
        with path.open('w') as output:
            outcome=subprocess.run(command,cwd=root,env=env,stdout=output,stderr=subprocess.STDOUT)
        row={'command':command,'exitCode':outcome.returncode,'seconds':round(time.monotonic()-started,2),'log':str(path)}
        results.append(row)
        print(json.dumps(row),flush=True)
        if outcome.returncode:
            print(path.read_text(errors='replace')[-7000:],flush=True)
            break
after=fingerprint()
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'root local migration acceptance; ARM64, no Intel/Windows runtime or 95 coverage claim','before':before,'after':after,'sourceStable':before==after,'results':results,'passed':len(results)==len(commands) and all(row['exitCode']==0 for row in results) and before==after}
(team/'auditor-root-rust-latest-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['before','after']}),flush=True)
