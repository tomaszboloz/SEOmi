from pathlib import Path
import subprocess, hashlib

source = Path('/Users/tomaszboloz/.codex/worktrees/chunk-recovery-review/seomi')
target = Path('/Users/tomaszboloz/.codex/worktrees/ai-trust-integration-050/seomi')
out = Path('/tmp/seomi-next-20261027/eetv-import')
out.mkdir(exist_ok=True)
base = '70a562c48674b6add386874756f43fc53b9bc1d6'
names = [
    'src/services/contracts/crawl/crawlFindings.ts', 'src/services/eeatTrust/authors.ts',
    'src/services/eeatTrust/build.ts', 'src/services/eeatTrust/graph.ts',
    'src/services/eeatTrust/index.ts', 'src/services/eeatTrust/schemaScore.ts',
    'src/services/eeatTrust/types.ts', 'src/types/crawl/findings.ts',
    'src/services/eeatTrust/entityGraph.ts', 'tests/eeatTrustEntityGraph.test.ts',
]
for index, name in enumerate(names):
    theirs = (source / name).read_bytes()
    previous = subprocess.run(['rtk', 'proxy', 'git', 'show', f'{base}:{name}'], cwd=source, capture_output=True)
    dest = target / name
    if previous.returncode:
        if dest.exists():
            raise RuntimeError(f'Refusing to overwrite existing new file: {name}')
        dest.write_bytes(theirs)
        print('new', name)
        continue
    ours = dest.read_bytes()
    for label, data in [('ours', ours), ('base', previous.stdout), ('theirs', theirs)]:
        (out / f'{index}.{label}').write_bytes(data)
    result = subprocess.run(['rtk', 'proxy', 'git', 'merge-file', '-p', '--diff3',
        str(out / f'{index}.ours'), str(out / f'{index}.base'), str(out / f'{index}.theirs')], capture_output=True)
    (out / f'{index}.merged').write_bytes(result.stdout)
    if result.returncode:
        print('CONFLICT', name, str(out / f'{index}.merged'))
        continue
    if hashlib.sha256(dest.read_bytes()).digest() != hashlib.sha256(ours).digest():
        raise RuntimeError(f'Concurrent edit: {name}')
    dest.write_bytes(result.stdout)
    print('merged', name)
