import fcntl, hashlib, json, pathlib, subprocess, sys
root=pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
team=pathlib.Path(__file__).parent
lock=open('/tmp/seomi-gemini-validation.lock','w')
fcntl.flock(lock,fcntl.LOCK_EX)
def hashes():
    data=subprocess.check_output(['rtk','proxy','git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root)
    return {name.decode():hashlib.sha256((root/name.decode()).read_bytes()).hexdigest() for name in data.split(b'\0') if name}
before=hashes()
cmds=[['rtk','proxy','npm','exec','--yes','--package=node@22','--','node','node_modules/vitest/vitest.mjs','run','tests/releaseProductBranding.test.ts','tests/releaseSourcePolicy.test.ts','tests/releaseArtifactContainment.test.ts','tests/releaseCiGateProvenance.test.ts','tests/releaseCiGateProvenanceRetry.test.ts'],['rtk','proxy','node','scripts/release-source-policy.mjs'],['rtk','proxy','npx','tsc','--noEmit'],['rtk','npm','run','lint'],['rtk','npm','run','check:loc'],['rtk','npm','run','version:check'],['rtk','git','diff','--check']]
print('final branding validation lock acquired',flush=True)
rows=[]
for i,cmd in enumerate(cmds):
    log=team/('root-branding-v16-'+str(i)+'.log')
    with log.open('w') as out:
        result=subprocess.run(cmd,cwd=root,stdout=out,stderr=subprocess.STDOUT)
    rows.append({'cmd':cmd,'exitCode':result.returncode,'log':str(log)})
    print(json.dumps(rows[-1]),flush=True)
    if result.returncode:
        print(log.read_text()[-8000:],flush=True)
        break
stable=before==hashes()
report={'checks':rows,'sourceStable':stable,'filesHashed':len(before),'hashes':before}
(team/'root-branding-v16-validation.json').write_text(json.dumps(report,indent=2)+'\n')
sys.exit(rows[-1]['exitCode'] or int(not stable))
