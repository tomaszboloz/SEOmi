import json, os, pathlib, subprocess, sys

root = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
target = pathlib.Path('/Volumes/Kingston/seomi-build/rust-latest-review')
env = os.environ.copy()
env['CARGO_TARGET_DIR'] = str(target)
env['SEOMI_E2E_RENDERER'] = '1'
build = subprocess.run(['rtk', 'proxy', 'cargo', 'build', '--manifest-path', 'src-tauri/Cargo.toml', '--example', 'desktop_e2e', '--features', 'custom-protocol,test-fixture'], cwd=root, env=env)
if build.returncode:
    sys.exit(build.returncode)
report = root / 'test-results/desktop-e2e.json'
report.parent.mkdir(exist_ok=True)
if report.exists():
    report.unlink()
try:
    run = subprocess.run([str(target / 'debug/examples/desktop_e2e'), str(report)], cwd=root, env=env, timeout=210)
except subprocess.TimeoutExpired:
    print('Desktop E2E runtime timed out at the existing 210-second limit.')
    sys.exit(1)
if not report.exists():
    sys.exit('Desktop E2E did not write its report.')
result = json.loads(report.read_text())
print(json.dumps(result, indent=2))
sys.exit(0 if run.returncode == 0 and result.get('passed') is True else 1)
