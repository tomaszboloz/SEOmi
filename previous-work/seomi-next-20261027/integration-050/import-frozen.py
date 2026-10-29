import pathlib,subprocess,json,hashlib,sys
owner,source=sys.argv[1:3];src=pathlib.Path(source);dst=pathlib.Path('/Users/tomaszboloz/.codex/worktrees/ai-trust-integration-050/seomi');e=pathlib.Path(__file__).parent/('import-'+owner);e.mkdir(exist_ok=False)
def run(args,**kw):return subprocess.run(['rtk','proxy',*args],capture_output=True,**kw)
head=run(['git','rev-parse','HEAD'],cwd=src).stdout.decode().strip()
changed=run(['git','diff','--name-only','HEAD','-z'],cwd=src).stdout.split(b'\0');untracked=run(['git','ls-files','--others','--exclude-standard','-z'],cwd=src).stdout.split(b'\0');files=sorted(set(x.decode() for x in changed+untracked if x))
if len(sys.argv)>3:files=sys.argv[3:]
absent=object()
def merge(b,o,t):
 if o==b:return t
 if t==b or o==t:return o
 if all(isinstance(x,dict) for x in (b,o,t)):
  out={}
  for k in dict.fromkeys([*o,*t,*b]):
   v=merge(b.get(k,absent),o.get(k,absent),t.get(k,absent))
   if v is not absent:out[k]=v
  return out
 raise ValueError('conflicting JSON leaf')
rows=[];writes={}
for f in files:
 assert '..' not in pathlib.Path(f).parts and not pathlib.Path(f).is_absolute()
 base=run(['git','show',head+':'+f],cwd=src);b=base.stdout if base.returncode==0 else b'';o=(dst/f).read_bytes() if (dst/f).exists() else b'';t=(src/f).read_bytes() if (src/f).exists() else b''
 for name,data in [('base',b),('ours',o),('theirs',t)]:
  p=e/name/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 status='direct'
 if o==b:m=t
 elif t==b or o==t:m=o;status='preserved'
 elif f.endswith('.json'):
  try:m=(json.dumps(merge(json.loads(b),json.loads(o),json.loads(t)),ensure_ascii=False,indent=2)+'\n').encode();status='json-union'
  except (ValueError,TypeError):m=None;status='conflict'
 else:
  r=run(['git','merge-file','-p',str(e/'ours'/f),str(e/'base'/f),str(e/'theirs'/f)])
  m=r.stdout if r.returncode==0 else None;status='text-merge' if m is not None else 'conflict'
 if m is not None:writes[f]=m
 rows.append({'path':f,'status':status,'workerSHA256':hashlib.sha256(t).hexdigest(),'beforeSHA256':hashlib.sha256(o).hexdigest(),'afterSHA256':hashlib.sha256(m).hexdigest() if m is not None else None})
for f,data in writes.items():
 p=dst/f;p.parent.mkdir(parents=True,exist_ok=True)
 if data:p.write_bytes(data)
 elif p.exists():p.unlink()
(e/'import.json').write_text(json.dumps({'owner':owner,'base':head,'files':rows},indent=2)+'\n')
print(json.dumps({'owner':owner,'imported':len(writes),'conflicts':[r['path'] for r in rows if r['status']=='conflict'],'jsonUnions':[r['path'] for r in rows if r['status']=='json-union']}))
