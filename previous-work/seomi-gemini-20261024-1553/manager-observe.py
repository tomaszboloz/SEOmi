from pathlib import Path
import json,subprocess,re,datetime
p=Path(__file__).parent;rows=json.loads((p/'registry.json').read_text());processes=[]
for line in subprocess.run(['ps','-axo','pid=,args='],capture_output=True,text=True).stdout.splitlines():
 parts=line.strip().split(None,1)
 if len(parts)==2 and parts[1].startswith('/Users/tomaszboloz/.local/bin/agy --conversation '):processes.append((int(parts[0]),parts[1]))
obs=[];now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for r in rows:
 r['livePids']=[pid for pid,command in processes if '--conversation '+r['activeConversationId']+' ' in command]
 events=[]
 for line in Path(r['activeLog']).read_text().splitlines():
  try:events.append(json.loads(line))
  except:pass
 terminal=[e for e in events if e.get('event')=='result'];last=next((e['step_update'] for e in reversed(events) if e.get('step_update')),{})
 log=p/(r['role']+'.'+r['activeLabel']+'.agy.log');emails=re.findall(r'applyAuthResult: email=([^,\s]+)',log.read_text(errors='replace'))
 r.update(lastStep=last.get('step_index'),lastObservedAt=now,lastTerminalResult=terminal[-1] if terminal else None)
 obs.append({'enabled':r.get('enabled',True),'role':r['role'],'conversationId':r['activeConversationId'],'account':emails[-1] if emails else None,'model':'gemini-3.8-flash-high','effort':'high','livePids':r['livePids'],'session':r['activeSupervisorSession'],'log':r['activeLog'],'last':last,'terminal':r['lastTerminalResult']})
(p/'registry.json').write_text(json.dumps(rows,indent=2)+'\n');report={'at':now,'allEightLive':all(len(x['livePids'])==1 for x in obs),'allAccountsCorrect':all(x['account']=='opowiesciodkrywcow@gmail.com'for x in obs if x['enabled']),'distinctConversations':len({x['conversationId']for x in obs}),'workers':obs};(p/'eight-wiedzamoto-live-current.json').write_text(json.dumps(report,indent=2)+'\n')
report.update(maxTotalAgents=6,maxGeminiWorkers=5,managerCount=1,maxActiveAgents=5,activeAgents=sum(bool(x['livePids'])for x in obs),enabledAgents=sum(x['enabled']for x in obs),allEnabledLive=all(bool(x['livePids'])for x in obs if x['enabled']))
(p/'gemini-team-live-current.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k!='workers'}))
for x in obs:
 if not x['enabled']:continue
 print(x['role'],x['livePids'],x['last'].get('step_index'),x['last'].get('step_type'),x['last'].get('tool_info',{}).get('parameters'),x['terminal'])
