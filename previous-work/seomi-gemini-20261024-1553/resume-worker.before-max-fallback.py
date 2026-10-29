import json, os, pathlib, re, signal, subprocess, sys, time
team=pathlib.Path(__file__).parent
role=sys.argv[1]
rows=json.loads((team/'registry.json').read_text())
job=next(row for row in rows if row['role']==role)
conversation=job['activeConversationId']
label=sys.argv[2] if len(sys.argv)>2 else 'reattached'
log=team/(role+'.'+label+'.agy.log')
stream=team/(role+'.'+label+'.stream.jsonl')
promptFile=team/(role+'.next.prompt.txt')
prompt=promptFile.read_text() if promptFile.exists() else ('Kontynuuj tę samą rozmowę i zachowaj dotychczasową pracę. Nie uruchamiaj nowych agentów. CLI zakończyło samo obserwowanie po 30 minutach, to nie jest dowód ukończenia. Czytaj '+str(team/'manager-updates.md')+' i '+str(team/(role+'.audit.md'))+'. Dokończ ownership z pierwotnego zadania, konkretny kod i testy. Model wyłącznie Gemini High, konto wiedzamoto@gmail.com. W końcu zapisz '+str(team/(role+'.report.json'))+' z rzeczywistymi wynikami i lukami. Nie commituj/pushuj/merguj/publikuj.')
argv=['rtk','proxy','agy','--conversation',conversation,'--model','gemini-3.8-flash-high','--effort','high','--mode','accept-edits','--dangerously-skip-permissions','--output-format','stream-json','--print-timeout','0','--log-file',str(log),'--print',prompt]
with stream.open('w') as output:
 process=subprocess.Popen(argv,cwd=job['cwd'],stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
 verified=False
 while process.poll() is None:
  emails=re.findall(r'applyAuthResult: email=([^,\s]+)',log.read_text(errors='replace') if log.exists() else '')
  if any(email!='wiedzamoto@gmail.com' for email in emails):
   os.killpg(process.pid,signal.SIGTERM);print(json.dumps({'role':role,'accountMismatch':True}),flush=True);break
  if emails and not verified:
   verified=True;print(json.dumps({'role':role,'sameConversation':conversation,'accountVerified':emails[-1],'pid':process.pid}),flush=True)
  time.sleep(0.5)
 code=process.wait()
result={'role':role,'conversationId':conversation,'reattached':True,'exitCode':code,'accountVerified':verified,'stream':str(stream)}
(team/(role+'.'+label+'-result.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
