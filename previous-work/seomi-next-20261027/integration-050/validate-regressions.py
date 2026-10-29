import os,subprocess,pathlib,json
p=pathlib.Path('/tmp/seomi-next-20261027/integration-050');env=os.environ.copy();env['PATH']='/Users/tomaszboloz/.nvm/versions/node/v24.19.0/bin:'+env['PATH'];rows=[]
commands=[('fix-typecheck', ['rtk', 'npx', 'tsc', '--noEmit']), ('fix-tests', ['rtk', 'npx', 'vitest', 'run', 'tests/cmsPatchGates.test.ts', 'tests/crawlExecutionActionsDirect.test.ts', 'tests/crawlExecutionEdgesDirect.test.ts', 'tests/coverage100DomainRemainingA.test.tsx', 'tests/coverage100ServicesRemainingHooks.test.tsx', 'tests/typeContracts.test.ts', 'tests/apiSettingsTab.test.tsx', 'tests/i18n.test.ts', 'tests/i18nLocalizesTheRenderWorkerSettingsWorkflowInEveryNon.test.ts', 'tests/geminiGapGOVERNORServicesA.test.ts', 'tests/scoreDropHooks.test.ts', 'tests/trustHelpersDirect.test.ts', 'tests/modelTypeContracts.test.ts', 'tests/nativeLoggingContract.test.ts', 'tests/trustEvidenceFollowup.test.ts', 'tests/trustEvidenceContracts.test.ts']), ('fix-lint', ['rtk', 'npm', 'run', 'lint']), ('fix-loc', ['rtk', 'npm', 'run', 'check:loc']), ('fix-diff', ['rtk', 'git', 'diff', '--check'])]
for name,cmd in commands:
 print(name+' running',flush=True)
 with (p/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd='/Users/tomaszboloz/.codex/worktrees/ai-trust-integration-050/seomi',env=env,stdout=f,stderr=subprocess.STDOUT)
 rows.append({'name':name,'exitCode':r.returncode});print(rows[-1],flush=True)
 if r.returncode:print((p/(name+'.log')).read_text()[-5000:],flush=True)
(p/'fix-validation.json').write_text(json.dumps(rows,indent=2)+'\n')
