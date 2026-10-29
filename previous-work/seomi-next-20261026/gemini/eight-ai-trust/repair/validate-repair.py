import pathlib,subprocess,json,time,hashlib
team=pathlib.Path('/tmp/seomi-next-20261026/gemini/eight-ai-trust/repair');ws=pathlib.Path('/Users/tomaszboloz/.codex/worktrees/gemini-easy-next/seomi')
assert (team/'supervisor-result.json').is_file(),'Gemini still running; do not validate unfrozen tests'
hashes=json.loads((team/'source-hashes.json').read_text());assert not [f for f,h in hashes.items() if hashlib.sha256((ws/f).read_bytes()).hexdigest()!=h],'Protected source drift'
tests=sorted(str(p.relative_to(ws)) for p in (ws/'tests').glob('geminiAITrust*.test.*'));frozen={f:hashlib.sha256((ws/f).read_bytes()).hexdigest() for f in tests};(team/'new-test-hashes.json').write_text(json.dumps(frozen,indent=2)+'\n')
for f in tests:assert len((ws/f).read_text().splitlines())<=150,f
results=[]
for name,cmd in [('vitest',['rtk','npx','vitest','run',*tests]),('typecheck',['rtk','npx','tsc','--noEmit']),('lint',['rtk','npx','eslint',*tests,'--max-warnings','0']),('loc',['rtk','npm','run','check:loc']),('diff',['rtk','git','diff','--check'])]:
 print(json.dumps({'step':name,'state':'running'}),flush=True)
 with (team/(name+'.log')).open('w') as out:r=subprocess.run(cmd,cwd=ws,stdout=out,stderr=subprocess.STDOUT)
 row={'step':name,'exitCode':r.returncode};results.append(row);print(json.dumps(row),flush=True)
 if r.returncode:print((team/(name+'.log')).read_text()[-6500:],flush=True)
(team/'validation-result.json').write_text(json.dumps({'results':results,'newFiles':len(tests),'sourceStable':all(hashlib.sha256((ws/f).read_bytes()).hexdigest()==h for f,h in hashes.items()),'testsStable':all(hashlib.sha256((ws/f).read_bytes()).hexdigest()==h for f,h in frozen.items())},indent=2)+'\n')
print((team/'vitest.log').read_text()[-3000:],flush=True)
raise SystemExit(any(r['exitCode'] for r in results))
