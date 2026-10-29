from pathlib import Path
import subprocess,json
p=Path('/tmp/seomi-next-20261027/integration-050')
results=[]
for name,cmd in [('ui-vitest', ['rtk', 'npx', 'vitest', 'run', 'tests/aioRewriteLifecycle.test.tsx', 'tests/schemaComposition.test.ts']), ('ui-typecheck', ['rtk', 'npx', 'tsc', '--noEmit']), ('ui-loc', ['rtk', 'npm', 'run', 'check:loc'])]:
 print(name+" running",flush=True)
 with (p/(name+".log")).open("w") as f:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT)
 results.append({"step":name,"exitCode":r.returncode});print(results[-1],flush=True)
 if r.returncode:print((p/(name+".log")).read_text()[-3500:],flush=True)
(p/"ui-validation.json").write_text(json.dumps(results,indent=2)+"\n")
