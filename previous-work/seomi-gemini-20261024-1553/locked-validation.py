#!/usr/bin/env python3
import fcntl
import subprocess
import sys

args = sys.argv[1:]
if args and args[0] == '--':
    args = args[1:]
if not args:
    raise SystemExit('Pass the validation command after --')
with open('/tmp/seomi-gemini-validation.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    raise SystemExit(subprocess.run(args).returncode)
