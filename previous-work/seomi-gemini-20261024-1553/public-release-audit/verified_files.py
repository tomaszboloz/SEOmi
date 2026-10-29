import base64
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlparse

REPO = 'tomaszboloz/SEOmi'
TAG = 'v0.4.41'
SHA = '3bb9d5b671824a82dece0512422fb076f84172f1'
OUT = Path('/Volumes/Kingston/seomi-build/release0441-recovery')


def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def verify_manifest(manifest, assets):
    assert manifest['version'] == '0.4.41'
    expected = {
        'darwin-aarch64': {'SEOmi_aarch64.app.tar.gz', 'SEOmi_0.4.41_aarch64.app.tar.gz'},
        'darwin-x86_64': {'SEOmi_x64.app.tar.gz', 'SEOmi_0.4.41_x64.app.tar.gz'},
        'windows-x86_64': {'SEOmi_0.4.41_x64-setup.exe', 'SEOmi_0.4.41_x64_en-US.msi'},
    }
    assert set(manifest['platforms']) == set(expected)
    selected = {}
    for platform, entry in manifest['platforms'].items():
        url = urlparse(entry['url'])
        name = unquote(url.path.rsplit('/', 1)[-1])
        assert name in expected[platform] and name in assets and name + '.sig' in assets
        assert entry['url'] == f'https://github.com/{REPO}/releases/download/{TAG}/{name}'
        assert not url.query and not url.fragment and url.netloc == 'github.com'
        assert entry['signature'].strip() == (OUT / (name + '.sig')).read_text().strip()
        selected[platform] = name
    return selected


def verify_signatures(assets, config):
    key = OUT / 'updater-public-key.pub'
    key.write_bytes(base64.b64decode(config['plugins']['updater']['pubkey'].strip(), validate=True))
    results = {}
    for name in assets:
        if not name.endswith(('.app.tar.gz', '.msi', '.exe')):
            continue
        signature = OUT / (name + '.decoded.minisig')
        signature.write_bytes(base64.b64decode((OUT / (name + '.sig')).read_text().strip(), validate=True))
        result = subprocess.run(['minisign', '-Vm', str(OUT / name), '-x', str(signature), '-p', str(key)], capture_output=True, text=True)
        (OUT / (name + '.minisign.log')).write_text(result.stdout + result.stderr)
        assert result.returncode == 0, f'Invalid signature: {name}'
        results[name] = 'verified'
    assert len(results) == 6
    return results


def verify_provenance(provenance, checksums, assets):
    assert provenance['repository'] == REPO and provenance['tag'] == TAG
    assert provenance['commitSha'] == SHA and provenance['version'] == '0.4.41'
    subjects = provenance['subjects']
    assert len(subjects) == 7 and len({s['name'] for s in subjects}) == 7
    assert {s['name'] for s in subjects} == set(checksums)
    for subject in subjects:
        name = subject['name']
        assert name in assets and subject['sha256'] == checksums[name] == digest(OUT / name)
        assert subject['size'] == (OUT / name).stat().st_size
    assert {s['name'] for s in provenance['sboms']} == {'sbom-node.json', 'sbom-rust.json'}
    counts = {}
    for sbom in provenance['sboms']:
        name = sbom['name']
        assert sbom['sha256'] == digest(OUT / name)
        document = json.loads((OUT / name).read_text())
        assert document['bomFormat'] == 'CycloneDX' and isinstance(document['components'], list) and document['components']
        counts[name] = len(document['components'])
    return counts
