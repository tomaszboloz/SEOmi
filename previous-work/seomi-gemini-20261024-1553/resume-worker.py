import json, os, pathlib, re, signal, subprocess, sys, time
team=pathlib.Path(__file__).parent
role=sys.argv[1]
rows=json.loads((team/'registry.json').read_text())
job=next(row for row in rows if row['role']==role)
if not job.get('enabled',True):
 raise SystemExit('Role deferred by the user concurrency cap; not launching '+role)
activeArgs=subprocess.run(['ps','-axo','args='],capture_output=True,text=True).stdout.splitlines()
known={row['activeConversationId'] for row in rows}
activeConversations=set()
for command in activeArgs:
 command=command.strip()
 if not (command.startswith('/Users/tomaszboloz/.local/bin/agy --conversation ') or command.startswith('rtk proxy agy --conversation ')): continue
 match=re.search(r'--conversation ([a-f0-9-]{36})',command)
 if match and match.group(1) in known:activeConversations.add(match.group(1))
if job['activeConversationId'] in activeConversations:raise SystemExit('This conversation already has a live process')
if len(activeConversations)>=6:raise SystemExit('User cap reached: six Gemini workers; the root manager is coordinated separately')
conversation=job['activeConversationId']
label=sys.argv[2] if len(sys.argv)>2 else 'reattached'
expectedAccount=job.get('requiredAccount','wiedzamoto@gmail.com')
effort=job.get('effort','high')
log=team/(role+'.'+label+'.agy.log')
stream=team/(role+'.'+label+'.stream.jsonl')
promptFile=pathlib.Path(job['prompt'])
prompt=promptFile.read_text() if promptFile.exists() else ('Kontynuuj tę samą rozmowę i zachowaj dotychczasową pracę. Nie uruchamiaj nowych agentów. CLI zakończyło samo obserwowanie po 30 minutach, to nie jest dowód ukończenia. Czytaj '+str(team/'manager-updates.md')+' i '+str(team/(role+'.audit.md'))+'. Dokończ ownership z pierwotnego zadania, konkretny kod i testy. Model wyłącznie Gemini High, konto wiedzamoto@gmail.com. W końcu zapisz '+str(team/(role+'.report.json'))+' z rzeczywistymi wynikami i lukami. Nie commituj/pushuj/merguj/publikuj.')
argv=['rtk','proxy','agy','--conversation',conversation,'--model','gemini-3.8-flash-high','--effort',effort,'--mode','accept-edits','--dangerously-skip-permissions','--output-format','stream-json','--print-timeout','0','--log-file',str(log),'--print',prompt]
with stream.open('w') as output:
 process=subprocess.Popen(argv,cwd=job['cwd'],stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
 verified=False
 while process.poll() is None:
  emails=re.findall(r'applyAuthResult: email=([^,\s]+)',log.read_text(errors='replace') if log.exists() else '')
  if any(email!=expectedAccount for email in emails):
   os.killpg(process.pid,signal.SIGTERM);print(json.dumps({'role':role,'accountMismatch':True}),flush=True);break
  if emails and not verified:
   verified=True;print(json.dumps({'role':role,'sameConversation':conversation,'accountVerified':emails[-1],'pid':process.pid,'effort':effort,'model':job['model']}),flush=True)
  time.sleep(0.5)
 code=process.wait()
result={'role':role,'conversationId':conversation,'reattached':True,'exitCode':code,'accountVerified':verified,'stream':str(stream)}
(team/(role+'.'+label+'-result.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
