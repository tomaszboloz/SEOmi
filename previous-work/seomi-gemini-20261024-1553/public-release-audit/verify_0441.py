import json
import re
import subprocess
from datetime import datetime, timezone

from verified_files import REPO, TAG, SHA, OUT, gh, digest, verify_manifest, verify_signatures, verify_provenance

OUT.mkdir(exist_ok=True)
release = json.loads(gh('api', f'repos/{REPO}/releases/tags/{TAG}'))
assert release['id'] == 424203629 and not release['draft'] and release['published_at']
assert release['target_commitish'] == SHA
ref = json.loads(gh('api', f'repos/{REPO}/git/ref/tags/{TAG}'))
assert ref['object']['type'] == 'commit' and ref['object']['sha'] == SHA
pages = json.loads(gh('api', '--paginate', '--slurp', f'repos/{REPO}/releases/424203629/assets?per_page=100'))
rows = [asset for page in pages for asset in page]
assets = {asset['name']: asset for asset in rows}
assert len(rows) == len(assets) == 19
for name, asset in assets.items():
    assert re.fullmatch(r'[A-Za-z0-9_.+-]+', name) and asset['state'] == 'uploaded'
    file = OUT / name
    assert not file.is_symlink()
    if not file.exists():
        subprocess.run(['gh', 'release', 'download', TAG, '--repo', REPO, '--pattern', name, '--dir', str(OUT)], check=True, capture_output=True)
    assert file.stat().st_size == asset['size']
    assert asset['digest'] == 'sha256:' + digest(file), name
    print('Asset hash PASS:', name, flush=True)
(OUT / 'public-release-metadata.json').write_text(json.dumps(release, indent=2) + '\n')
manifest = json.loads((OUT / 'latest.json').read_text())
selected = verify_manifest(manifest, assets)
checksum_lines = (OUT / 'SHA256SUMS.txt').read_text().strip().splitlines()
assert len(checksum_lines) == 7
checksums = {}
for line in checksum_lines:
    match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_.+-]+)', line)
    assert match and match[2] not in checksums
    checksums[match[2]] = match[1]
provenance = json.loads((OUT / 'release-provenance.json').read_text())
sboms = verify_provenance(provenance, checksums, assets)
config = json.loads(subprocess.check_output(['git', 'show', SHA + ':src-tauri/tauri.conf.json'], text=True))
signatures = verify_signatures(assets, config)
attestations = {}
subjects = set(checksums) | set(selected.values())
for name in sorted(subjects):
    command = ['gh', 'attestation', 'verify', str(OUT / name), '--repo', REPO,
               '--source-digest', SHA, '--source-ref', 'refs/heads/main',
               '--signer-workflow', REPO + '/.github/workflows/release.yml',
               '--signer-digest', SHA, '--deny-self-hosted-runners', '--format', 'json']
    result = subprocess.run(command, capture_output=True, text=True)
    (OUT / (name + '.attestation.json')).write_text(result.stdout)
    (OUT / (name + '.attestation.log')).write_text(result.stderr)
    assert result.returncode == 0, f'Attestation failed: {name}: {result.stderr}'
    parsed = json.loads(result.stdout)
    assert isinstance(parsed, list) and parsed
    attestations[name] = {'verified': True, 'sha256': digest(OUT / name), 'results': len(parsed)}
    print('Actual attestation PASS:', name, flush=True)
final_ref = json.loads(gh('api', f'repos/{REPO}/git/ref/tags/{TAG}'))
assert final_ref['object']['sha'] == SHA
report = {'at': datetime.now(timezone.utc).isoformat(), 'status': 'pass', 'release': release['html_url'],
          'publishedAt': release['published_at'], 'sourceCommit': SHA, 'tagCommit': final_ref['object']['sha'],
          'assetsVerified': len(assets), 'manifestPlatforms': selected, 'signatures': signatures,
          'checksumSubjects': checksums, 'sbomComponents': sboms, 'actualAttestations': attestations,
          'proofScope': 'Downloaded release bytes, paired signatures, source-bound Sigstore attestations; no claim of installing every platform'}
(OUT / 'independent-public-release-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report), flush=True)
