import concurrent.futures,json,pathlib,subprocess,time,os
team=pathlib.Path('/tmp/seomi-next-20261026/gemini/eight-ai-trust/refine');conversations=json.loads((team/'conversations.json').read_text());ws='/Users/tomaszboloz/.codex/worktrees/gemini-easy-next/seomi'
(team/'supervisor.pid').write_text(str(os.getpid()))
def worker(i):
 start=time.time();prompt=(team/f'worker-{i:02d}.prompt.txt').read_text()
 with (team/f'worker-{i:02d}.jsonl').open('w') as out:
  p=subprocess.Popen(['rtk','proxy','agy','--conversation',conversations[str(i)],'--model','gemini-3.8-flash-high','--effort','high','--mode','accept-edits','--output-format','stream-json','--log-file',str(team/f'worker-{i:02d}.agy.log'),'--print',prompt],cwd=ws,stdout=out,stderr=subprocess.STDOUT)
  (team/f'worker-{i:02d}.pid').write_text(str(p.pid));print(json.dumps({'worker':i,'pid':p.pid,'state':'started'}),flush=True);code=p.wait()
 result={'worker':i,'exit':code,'seconds':round(time.time()-start,1)};(team/f'worker-{i:02d}-exit.json').write_text(json.dumps(result)+'\n');print(json.dumps(result),flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(worker,range(1,9)))
(team/'supervisor-result.json').write_text(json.dumps(results,indent=2)+'\n')
