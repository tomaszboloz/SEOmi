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
worktree_dir = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/rust-latest-review/seomi')
target_dir = '/Volumes/Kingston/seomi-build/rust-latest-review'
summary_file = team_dir / 'rust-latest-review-summary.json'
manifest_path = str(worktree_dir / 'src-tauri/Cargo.toml')

stages = [
    (
        'cargo-fmt',
        ['rtk', 'proxy', 'cargo', 'fmt', '--manifest-path', manifest_path, '--check'],
        team_dir / 'rust-latest-fmt.log'
    ),
    (
        'cargo-clippy',
        ['rtk', 'proxy', 'cargo', 'clippy', '--manifest-path', manifest_path, '--all-targets', '--', '-D', 'warnings'],
        team_dir / 'rust-latest-clippy.log'
    ),
    (
        'cargo-test-all-targets',
        ['rtk', 'proxy', 'cargo', 'test', '--manifest-path', manifest_path, '--all-targets'],
        team_dir / 'rust-latest-tests.log'
    ),
    (
        'cargo-test-example-desktop-e2e',
        ['rtk', 'proxy', 'cargo', 'test', '--manifest-path', manifest_path, '--example', 'desktop_e2e', '--features', 'custom-protocol'],
        team_dir / 'rust-latest-example-desktop-e2e.log'
    ),
    (
        'cargo-run-example-coverage-sources',
        ['rtk', 'proxy', 'cargo', 'run', '--quiet', '--manifest-path', manifest_path, '--example', 'coverage_sources'],
        team_dir / 'rust-latest-example-coverage-sources.log'
    ),
    (
        'cargo-run-example-function-inventory',
        ['rtk', 'proxy', 'cargo', 'run', '--quiet', '--manifest-path', manifest_path, '--example', 'function_inventory'],
        team_dir / 'rust-latest-example-function-inventory.log'
    ),
]

print(f"[{now()}] Waiting for validation lock on {lock_path}...", flush=True)
with open(lock_path, 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    print(f"[{now()}] Acquired validation lock. Running rust-latest validations...", flush=True)

    env = os.environ.copy()
    env['CARGO_TARGET_DIR'] = target_dir

    results = []
    overall_passed = True

    for name, cmd, log_file in stages:
        stage_start = now()
        print(f"[{stage_start}] Starting stage: {name}", flush=True)
        with open(log_file, 'w') as log_out:
            proc = subprocess.Popen(
                cmd,
                cwd=worktree_dir,
                env=env,
                stdout=log_out,
                stderr=subprocess.STDOUT
            )
            exit_code = proc.wait()
        stage_finish = now()
        print(f"[{stage_finish}] Stage {name} finished with exit code: {exit_code}", flush=True)
        results.append({
            'stage': name,
            'command': ' '.join(cmd),
            'startedAt': stage_start,
            'finishedAt': stage_finish,
            'exitCode': exit_code,
            'passed': exit_code == 0,
            'logFile': str(log_file)
        })
        if exit_code != 0:
            overall_passed = False
            # Print tail of log
            tail = log_file.read_text(errors='replace').splitlines()[-25:]
            print(f"--- FAILURE in {name} ---")
            print('\n'.join(tail))
            print("-------------------------")
            break

    summary = {
        'at': now(),
        'targetDir': target_dir,
        'worktree': str(worktree_dir),
        'overallPassed': overall_passed,
        'stages': results
    }
    summary_file.write_text(json.dumps(summary, indent=2) + '\n')
    print(f"Summary written to {summary_file}", flush=True)

sys.exit(0 if overall_passed else 1)
