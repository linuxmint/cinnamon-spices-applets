#!/usr/bin/env python3
"""Codex meter: isolated accounts keyed by verified email; legacy profile migration."""
import json, os, pathlib, select, shutil, subprocess, sys, time, uuid
ROOT=pathlib.Path.home()/'.config/codex-meter'
CACHE=pathlib.Path.home()/'.cache/codex-meter'
STATUS=CACHE/'status.json'; CONFIG=ROOT/'config.json'

def load():
    ROOT.mkdir(parents=True,exist_ok=True)
    try: d=json.loads(CONFIG.read_text())
    except (OSError,ValueError): d={}
    if 'accounts' not in d:
        # Preserve legacy homes without treating arbitrary profile names as emails.
        d['accounts']={}
        for name,home in d.get('profiles',{}).items():
            if home: d['accounts']['legacy:'+name]=home
        d['active']=None
        save(d)
    if not isinstance(d['accounts'],dict):d['accounts']={}
    if d.get('active') not in d['accounts']:d['active']=next(iter(d['accounts']),None)
    return d

def save(d):
    ROOT.mkdir(parents=True,exist_ok=True)
    t=CONFIG.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2));os.chmod(t,0o600);t.replace(CONFIG)

def cli_env(home):
    env=os.environ.copy();env['CODEX_HOME']=str(home)
    return env

def cli():
    c=shutil.which('codex')
    if not c:
        for candidate in (pathlib.Path.home()/'.npm-global/bin/codex',pathlib.Path.home()/'.local/bin/codex',pathlib.Path.home()/'.nvm/current/bin/codex','/usr/local/bin/codex'):
            if pathlib.Path(candidate).is_file() and os.access(candidate,os.X_OK):return str(candidate)
        raise RuntimeError('Codex CLI not found. Install the official Codex CLI and ensure it is in PATH.')
    return c

def request(method,home,timeout=15):
    p=subprocess.Popen([cli(),'app-server'],env=cli_env(home),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0)
    try:
        def send(x):p.stdin.write((json.dumps(x)+'\n').encode());p.stdin.flush()
        def recv(i):
            end=time.monotonic()+timeout
            while time.monotonic()<end:
                ready,_,_=select.select([p.stdout],[],[],max(0,end-time.monotonic()))
                if not ready:break
                line=p.stdout.readline()
                if not line:break
                try:x=json.loads(line)
                except ValueError:continue
                if x.get('id')==i:
                    if 'error' in x:raise RuntimeError(str(x['error']))
                    return x.get('result') or {}
            raise RuntimeError('Codex app-server did not respond')
        send({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'clientInfo':{'name':'codex_meter','title':'Codex Meter','version':'1.4.1'},'capabilities':{}}})
        recv(1);send({'jsonrpc':'2.0','method':'initialized'})
        send({'jsonrpc':'2.0','id':2,'method':method,'params':{}})
        return recv(2)
    finally:
        p.terminate()
        try:p.wait(timeout=2)
        except subprocess.TimeoutExpired:p.kill()

def email_for(home):
    a=request('account/read',home).get('account') or {}
    email=a.get('email') if isinstance(a,dict) else None
    if not isinstance(email,str) or '@' not in email:raise RuntimeError('Codex did not provide a verified account email; account was not added')
    return email.strip().lower()

def bucket(x):
    if not isinstance(x,dict):return {'remaining':None,'reset_at':None}
    v=x.get('remainingPercent',x.get('remaining_percent'))
    if v is None:
        used=x.get('usedPercent',x.get('used_percent'))
        if used is not None:v=100-float(used)
    reset=x.get('resetsAt',x.get('reset_at'))
    if isinstance(reset,str):
        try:
            from datetime import datetime
            reset=int(datetime.fromisoformat(reset.replace('Z','+00:00')).timestamp())
        except ValueError:reset=None
    return {'remaining':max(0,min(100,float(v))) if v is not None else None,'reset_at':reset}

def refresh():
    d=load();CACHE.mkdir(parents=True,exist_ok=True)
    active=d['active'];out={'account':active,'five_hour':bucket(None),'weekly':bucket(None),'credits':None,'updated_at':int(time.time())}
    try:
        if active is None:raise RuntimeError('No account added. Left-click and choose Add account.')
        home=d['accounts'][active]
        r=request('account/rateLimits/read',home)
        limits=r.get('rateLimits',r)
        if isinstance(limits,list):limits=limits[0] if limits else {}
        if not isinstance(limits,dict):limits={}
        out['five_hour']=bucket(limits.get('primary',limits.get('primaryWindow')))
        out['weekly']=bucket(limits.get('secondary',limits.get('secondaryWindow')))
        for k in ('credits','creditBalance','balance'):
            if k in limits:out['credits']=limits[k];break
    except Exception as e:out['error']=str(e)
    t=STATUS.with_suffix('.tmp');t.write_text(json.dumps(out));t.replace(STATUS)
    return out

def accounts():
    d=load();return {'active':d['active'],'accounts':[x for x in d['accounts'] if not x.startswith('legacy:')]}

def add():
    d=load();home=ROOT/'accounts'/uuid.uuid4().hex;home.mkdir(parents=True,mode=0o700)
    print('Complete Codex sign-in in your browser.',flush=True)
    code=subprocess.call([cli(),'login'],env=cli_env(home))
    if code:raise RuntimeError('Codex login did not complete')
    email=email_for(home)
    d=load()
    if email in d['accounts']:
        # Existing account: use existing isolated home, don't silently overwrite credentials.
        print('This account is already saved; switching to it.',flush=True)
    else:d['accounts'][email]=str(home)
    d['active']=email;save(d);refresh()
    print('Added account: '+email,flush=True)
    return email

def switch(email):
    d=load()
    if email not in d['accounts'] or email.startswith('legacy:'):raise ValueError('Unknown account')
    d['active']=email;save(d);refresh();return accounts()

def remove(email):
    d=load()
    if email not in d['accounts'] or email.startswith('legacy:'):raise ValueError('Unknown account')
    home=d['accounts'][email]
    # Sign out of only this applet's isolated credentials, never shared CLI/editor sessions.
    code=subprocess.call([cli(),'logout'],env=cli_env(home))
    if code:raise RuntimeError('Codex logout failed; account retained')
    del d['accounts'][email]
    d['active']=next((x for x in d['accounts'] if not x.startswith('legacy:')),None)
    save(d);refresh()
    return {'removed':email}

def main():
    cmd=sys.argv[1] if len(sys.argv)>1 else 'refresh'
    if cmd=='refresh':print(json.dumps(refresh()))
    elif cmd=='accounts':print(json.dumps(accounts()))
    elif cmd=='add':
        add()
    elif cmd=='switch':print(json.dumps(switch(sys.argv[2])))
    elif cmd=='remove':print(json.dumps(remove(sys.argv[2])))
    else:raise ValueError('Unknown command')

if __name__=='__main__':
    try:main()
    except Exception as e:print('Error: '+str(e),file=sys.stderr);sys.exit(1)
