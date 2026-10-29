import pathlib,subprocess,os,json,time
p=pathlib.Path(__file__).parent;ws='/Users/tomaszboloz/.codex/worktrees/ai-trust-integration-050/seomi';env=os.environ.copy();env['PATH']='/Users/tomaszboloz/.nvm/versions/node/v24.19.0/bin:'+env['PATH'];env['CARGO_TARGET_DIR']='/Volumes/Kingston/www/seomi-target-trust050'
head=subprocess.check_output(['rtk','proxy','git','rev-parse','HEAD'],cwd=ws,text=True).strip();rows=[]
commands=[('full-frontend-coverage',['rtk','npm','run','test:coverage:target']),('mcp-coverage',['rtk','npm','run','test:coverage:mcp']),('rust-unit',['rtk','cargo','test','--manifest-path','src-tauri/Cargo.toml','--lib']),('rust-clippy',['rtk','cargo','clippy','--manifest-path','src-tauri/Cargo.toml','--lib','--','-D','warnings'])]
for name,cmd in commands:
 print(name+' running',flush=True);start=time.time()
 with (p/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=ws,env=env,stdout=f,stderr=subprocess.STDOUT)
 row={'name':name,'exitCode':r.returncode,'seconds':round(time.time()-start,2)};rows.append(row);print(row,flush=True)
 if r.returncode:print((p/(name+'.log')).read_text()[-6000:],flush=True)
 (p/'full-validation.json').write_text(json.dumps({'head':head,'results':rows,'complete':False},indent=2)+'\n')
(p/'full-validation.json').write_text(json.dumps({'head':head,'results':rows,'complete':True},indent=2)+'\n')
