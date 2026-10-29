import concurrent.futures
import json
from pathlib import Path
import subprocess
import time

team = Path('/tmp/seomi-gemini-20261024-1553/gemini-next')
workspace = '/Users/tomaszboloz/.codex/worktrees/review-next-batch/seomi'
conversations = json.loads((team / 'conversations.json').read_text())

def run_worker(index):
    started = time.time()
    with (team / f'worker-{index:02d}.file-only.jsonl').open('w') as log:
        prompt = (team / f'worker-{index:02d}.file-only-prompt.txt').read_text()
        command = ['rtk', 'proxy', 'agy', '--conversation', conversations[str(index)], '--model', 'gemini-3.8-flash-high', '--effort', 'high', '--mode', 'accept-edits', '--output-format', 'stream-json', '--log-file', str(team / f'worker-{index:02d}.file-only.agy.log'), '--print', prompt]
        process = subprocess.Popen(command, cwd=workspace, stdout=log, stderr=subprocess.STDOUT)
        (team / f'worker-{index:02d}.file-only.pid').write_text(str(process.pid))
        print(json.dumps({'worker': index, 'pid': process.pid, 'state': 'file-only-started'}), flush=True)
        code = process.wait()
    result = {'worker': index, 'exit': code, 'elapsedSeconds': time.time() - started}
    (team / f'worker-{index:02d}-file-only-exit.json').write_text(json.dumps(result) + '\n')
    print(json.dumps(result), flush=True)
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(run_worker, range(1, 7)))
(team / 'file-only-supervisor-result.json').write_text(json.dumps(results, indent=2) + '\n')
