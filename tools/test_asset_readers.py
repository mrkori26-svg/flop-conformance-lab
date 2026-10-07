import json,subprocess,sys,threading,time
from pathlib import Path
r=Path(__file__).resolve().parents[1];node=r.parent/'.runtime-tools/node/node.exe'
errors=[];done=threading.Event();reads=[0]
fixtures=list((r/'conformance/fixtures').glob('*.json'))
def read():
    while not done.is_set():
        for p in fixtures:
            try:json.loads((r/'dist/conformance/fixtures'/p.name).read_text(encoding='utf-8'));reads[0]+=1
            except Exception as exc:errors.append(str(exc))
t=threading.Thread(target=read);t.start()
try:
    for _ in range(15):subprocess.run([str(node),'tools/copy-assets.js'],cwd=r,check=True,creationflags=0x08000000)
finally:done.set();t.join()
assert not errors,errors[:10]
assert reads[0]>100,reads
for folder in ['fixtures','sources','observatory','interactions']:
    a=r/'conformance'/folder;b=r/'dist/conformance'/folder
    src={p.relative_to(a) for p in a.rglob('*') if p.is_file()};dst={p.relative_to(b) for p in b.rglob('*') if p.is_file()}
    assert src==dst,(folder,src^dst)
    assert all((a/p).read_bytes()==(b/p).read_bytes() for p in src)
print(json.dumps({'passes':True,'concurrentBuilds':15,'successfulFixtureReads':reads[0],'fixtures':len(fixtures),'treeBytesMatch':True}))

