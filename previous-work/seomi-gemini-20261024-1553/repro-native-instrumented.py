import datetime
import fcntl
import json
import os
import pathlib
import subprocess
import sys

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

lock_path = '/tmp/seomi-gemini-validation.lock'
team_dir = pathlib.Path('/tmp/seomi-gemini-20261024-1553')
root_dir = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
target_dir = '/Volumes/Kingston/seomi-build/native-renderer-target/llvm-cov-target'
report_file = team_dir / 'desktop-e2e-instrumented-repro.json'
raw_log_file = team_dir / 'desktop-e2e-instrumented-repro.raw.log'
summary_file = team_dir / 'desktop-e2e-instrumented-repro-summary.json'

print(f"[{now()}] Waiting for validation lock on {lock_path}...", flush=True)
with open(lock_path, 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    print(f"[{now()}] Acquired validation lock. Starting instrumented desktop E2E...", flush=True)
    
    env = os.environ.copy()
    env['SEOMI_E2E_RENDERER'] = '1'
    env['CARGO_TARGET_DIR'] = target_dir

    cmd = [
        'rtk', 'proxy', 'cargo', '+nightly', 'llvm-cov', 'run',
        '--manifest-path', str(root_dir / 'src-tauri/Cargo.toml'),
        '--example', 'desktop_e2e',
        '--features', 'custom-protocol',
        '--no-report',
        '--',
        str(report_file)
    ]

    start_time = now()
    with open(raw_log_file, 'w') as log_out:
        proc = subprocess.Popen(
            cmd,
            cwd=root_dir,
            env=env,
            stdout=log_out,
            stderr=subprocess.STDOUT
        )
        exit_code = proc.wait()
    finish_time = now()
    print(f"[{finish_time}] Desktop E2E exited with code: {exit_code}", flush=True)

    validation_exit = None
    validation_output = ""
    if report_file.exists():
        val_cmd = [
            'rtk', 'proxy', 'node',
            str(root_dir / 'scripts/validate-desktop-e2e-report.mjs'),
            str(report_file)
        ]
        val_proc = subprocess.run(val_cmd, cwd=root_dir, capture_output=True, text=True)
        validation_exit = val_proc.returncode
        validation_output = val_proc.stdout + val_proc.stderr
        print(f"Validation output: {validation_output.strip()} (exit {validation_exit})", flush=True)
    
    summary = {
        'at': finish_time,
        'startedAt': start_time,
        'exitCode': exit_code,
        'harnessRoot': str(root_dir),
        'targetDir': target_dir,
        'reportFile': str(report_file),
        'rawLogFile': str(raw_log_file),
        'reportExists': report_file.exists(),
        'validationExit': validation_exit,
        'validationOutput': validation_output.strip()
    }
    summary_file.write_text(json.dumps(summary, indent=2) + '\n')
    print(f"Summary written to {summary_file}", flush=True)

sys.exit(exit_code)
