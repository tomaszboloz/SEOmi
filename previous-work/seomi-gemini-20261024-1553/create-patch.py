import pathlib
import subprocess

worktree = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/rust-latest-review/seomi')
patch_file = pathlib.Path('/tmp/seomi-gemini-20261024-1553/native.rust-latest-v3.patch')

# 1. Run git diff HEAD
tracked_diff = subprocess.check_output(
    ['git', '-C', str(worktree), 'diff', 'HEAD'],
    text=True
)

untracked_files = [
    'src-tauri/src/commands/rendered_artifacts/windows_tests.rs',
    'src-tauri/src/commands/site_crawler/orchestration/tests/rendered_prefetch_join_tests.rs',
    'tests/nativeCmsPatchResponse.rs'
]

untracked_diffs = []
for rel_path in untracked_files:
    file_path = worktree / rel_path
    content = file_path.read_text()
    lines = content.splitlines()
    header = (
        f"diff --git a/{rel_path} b/{rel_path}\n"
        f"new file mode 100644\n"
        f"--- /dev/null\n"
        f"+++ b/{rel_path}\n"
        f"@@ -0,0 +1,{len(lines)} @@\n"
    )
    body = "".join(f"+{line}\n" for line in lines)
    untracked_diffs.append(header + body)

full_patch = tracked_diff + "".join(untracked_diffs)
patch_file.write_text(full_patch)
print(f"Patch written to {patch_file} ({len(full_patch)} bytes)")

# Test with git apply --check on root
root_tree = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/release-next/seomi')
check_result = subprocess.run(
    ['git', '-C', str(root_tree), 'apply', '--check', str(patch_file)],
    capture_output=True,
    text=True
)
print(f"git apply --check on release-next exit code: {check_result.returncode}")
if check_result.returncode != 0:
    print(check_result.stderr)
else:
    print("git apply --check PASSED cleanly!")
